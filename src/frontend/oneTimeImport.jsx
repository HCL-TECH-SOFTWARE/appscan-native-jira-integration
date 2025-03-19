{/*
 *
 * Copyright 2025 HCL America, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */}
import React, { useEffect, useState } from 'react';
import {
    Form,
    FormSection,
    FormFooter,
    useForm,
    RequiredAsterisk,
    Textfield,
    Button,
    Box,
    Stack,
    Label,
    Text,
    SectionMessage,
    ErrorMessage,
    Spinner,
    ProgressBar,
    Inline,
    Heading
} from '@forge/react';
import { invoke, requestJira } from '@forge/bridge';
import { v4 as uuidv4 } from 'uuid';
import DefaultLoader from './components/defaultLoader';
import { storageKeys } from '../appConstants';
import { delay } from './utils';
import { useAppContext } from './context/appContext';
import messages from './messages';

const OneTimeImport = ({ isCredsExpired }) => {
    const [isOpen, setOpen] = useState(false);
    const [isImportProgress, setIsImportProgress] = useState(false);
    const [defaultMaxIssues, setDefaultMaxIssues] = useState(25);
    const [importStatus, setImportStatus] = useState('');
    const [isError, setError] = useState(false);
    const [isWarning, setIsWarning] = useState(false);
    const [showLoader, setShowLoader] = useState(false);
    const [isImportRunning, setIsImportRunning] = useState(false);
    const [currentIssueCount, setCurrentIssuecount] = useState(0);
    const [appCount, setAppCount] = useState(0);
    const [importTime, setImportTime] = useState();

    const { handleSubmit, register, getFieldId, formState } = useForm();
    const { errors, isSubmitting } = formState;

    const { loginStorage, configStorage } = useAppContext();

    useEffect(() => {
        const checkIfImportInProgress = async () => {
            setShowLoader(true);
            const importStatus = await invoke('storage', { storageKey: storageKeys.importStatus, type: "GET" });
            const oneTimeConfig = await invoke('storage', { storageKey: storageKeys.oneTimeImportConfig, type: "GET" });
            if (oneTimeConfig && Object.keys(oneTimeConfig).length != 0) {
                setDefaultMaxIssues(oneTimeConfig.maxIssues);
                setAppCount(oneTimeConfig.appCount);
            }
            const isInprogress = importStatus && Object.keys(importStatus).length != 0 && importStatus.isInProgress;
            await checkImportStatus(isInprogress, importStatus.importId);
        }
        checkIfImportInProgress();
    }, [])

    const handleOneTimeImportSubmit = async (oneTimeImportConfig) => {
        setOpen(false);
        setError(false);
        setIsWarning(false);
        setIsImportProgress(true);
        setImportTime(null);
        setImportStatus('Fetching import configurations...');

        let formData = configStorage;
        let credentials = loginStorage

        if (!formData) {
            formData = await invoke('storage', { storageKey: storageKeys.importConfiguration, type: "GET" });
        }

        if (!credentials) {
            credentials = await invoke('secretStorage', { storageKey: storageKeys.credentials, type: "GET" });
        }

        if (!formData || Object.keys(formData).length == 0) {
            setIsImportProgress(false);
            setError(true);
            setImportStatus(messages.configError);
            return;
        }

        if (!credentials || Object.keys(credentials).length == 0) {
            setIsImportProgress(false);
            setError(true);
            setImportStatus(messages.credsNotFound);
            return;
        }

        setImportStatus('Validating credentials with ASoC...');
        const data = await invoke('login', { url: credentials.url, keyId: credentials.keyId, keySecret: credentials.keySecret });

        if (data.hasOwnProperty("Message")) {
            setIsImportProgress(false);
            setError(true);
            setImportStatus(messages.expiredCredentials);
            return;
        }

        const authorizationHeader = `Bearer ${data.Token}`;

        let arrayOfAppIds = [];
        let allapps = formData.applicationId;
        let arrayOfValues = formData.applicationId.map(obj => obj.value);

        if (allapps.length == 0) {
            setIsImportProgress(false);
            setError(true);
            setImportStatus(messages.appsNotFound);
            return;
        }

        setImportStatus('Retrieving applications from ASoC...');
        if (arrayOfValues.includes('all') || formData.applicationId.length == 0) {
            let fetchAllAppsURL = credentials.url;
            const fetchAllAppsResponseJson = await invoke('fetchAllApps', { fetchAllAppsURL: fetchAllAppsURL, authorizationHeader: authorizationHeader });
            allapps = fetchAllAppsResponseJson.Items.map(x => { return { ...x, value: x.Id, label: x.Name } });
            for (const app of fetchAllAppsResponseJson.Items) {
                arrayOfAppIds.push(app.Id);
            }
        } else {

            arrayOfAppIds = arrayOfValues;
        }
        setAppCount(arrayOfAppIds.length);
        setImportStatus(`Found ${arrayOfAppIds.length} applications...`);

        const states = formData.issuesStates;
        const stateFilterBuilder = [];
        states.forEach((state) => {
            stateFilterBuilder.push(`Status eq '${state}' or`);
        });
        let stateFilter = stateFilterBuilder.join(" ");
        if (stateFilter.length > 1) {
            stateFilter = stateFilter.slice(0, -" or".length);
        }

        // severity filter
        const severities = formData.issueSeverityFilter;
        const severityFilterBuilder = [];
        // state filter
        severities.forEach((severity) => {
            severityFilterBuilder.push(`Severity eq '${severity}' or`);
        });

        let severityFilter = severityFilterBuilder.join(" ");

        if (severityFilter.length > 1) {
            severityFilter = severityFilter.slice(0, -" or".length);
        }

        // ScanType Filter

        const scantypes = formData.scanType;
        const scanTypeFilterBuilder = [];

        scantypes.forEach((scanType) => {
            scanTypeFilterBuilder.push(`DiscoveryMethod  eq '${scanType}' or`);
        });

        let scanTypeFilter = scanTypeFilterBuilder.join(" ");

        if (scanTypeFilter.length > 1) {
            scanTypeFilter = scanTypeFilter.slice(0, -" or".length);
        }

        let policyIds = null;

        if (formData.policyIds && formData.policyIds.length > 0) {

            policyIds = formData.policyIds
            .map(policy => policy.value);
               
        }

        setImportStatus(`Importing Issues...`);

        let currentDateTime = Date.now().toString();
        const importId = uuidv4();
        const finalArray = [];
        for (const appId of arrayOfAppIds) {
            const payload = {
                appId: appId,
                policyIds: policyIds,
                maxIssues: defaultMaxIssues,
                stateFilter: stateFilter,
                severityFilter: severityFilter,
                scanTypeFilter: scanTypeFilter,
                authorizationHeader: authorizationHeader,
                formData: formData,
                importId: importId,
                importDateTime: currentDateTime,
                importType: 'Manual',
                appScanUrl: credentials.url
            };
            finalArray.push(payload);
        }

        await invoke('pushIssuesForImport', { requestdata: finalArray });
        await invoke('storage', { formData: { maxIssues: defaultMaxIssues, appCount: arrayOfAppIds.length }, storageKey: storageKeys.oneTimeImportConfig, type: "POST" });
        setIsImportProgress(false);
        setCurrentIssuecount(0);
        await checkImportStatus(true, importId);
    };

    const checkImportStatus = async (status, importId) => {
        setIsImportRunning(status);
        setShowLoader(false);
        if (!status) {
            setOpen(false);
            return;
        }
        let issueImported = 0;
        let batchId = 1;
        let lastCount = 0;
        while (status) {
            const importStatus = await invoke('storage', { storageKey: storageKeys.importStatus, type: "GET" });

            status = importStatus && Object.keys(importStatus).length != 0 && importStatus.isInProgress;
            if (!status) {
                break;
            }

            setImportTime(importStatus.importTime);

            const isHistoryCalled = importStatus && Object.keys(importStatus).length != 0 && importStatus.isHistoryCalled;
            if (!isHistoryCalled) {
                const currentStatus = await invoke('getIssueCountByImportId', { importId: importId, batchId: batchId, lastCount: lastCount });
                if (currentStatus.count >= issueImported) {
                    issueImported = currentStatus.count;
                    setCurrentIssuecount(currentStatus.count);
                }
                batchId = currentStatus.batchId;
                lastCount = currentStatus.lastCount;
            }

            console.log('status', importStatus);
            await delay(5000);
        }
        setIsImportRunning(false);
        if (issueImported > 0) {
            setOpen(true);
        }
        else {
            setIsWarning(true);
        }

    }


    const handleMaxIssuesChange = (e) => {
        setDefaultMaxIssues(e.target.value);
    }

    return (
        <>
            <Box xcss={{
                width: '35%',
                position: 'relative'
            }}>
                {showLoader ? <DefaultLoader /> :
                    <Form onSubmit={handleSubmit(handleOneTimeImportSubmit)}>
                        {isCredsExpired ? <Box xcss={{marginTop:'space.100'}} ><SectionMessage appearance="error">
                            <Text>{messages.expiredCredentials}</Text>
                        </SectionMessage>  </Box>: ''}
                        <FormSection>
                            <Stack space="space.100">
                                
                            <Box xcss={{marginBottom:'space.100',marginTop:'space.0'}} >
                                    
                                    <Heading  as="h3">
                                    Start a one-time import from AppScan
                                    </Heading>
                                </Box>
                                <Box >
                                    <Label labelFor={getFieldId("maxIssues")}>
                                        Max issues per application
                                        <RequiredAsterisk />
                                    </Label>
                                    <Textfield
                                        {...register("maxIssues", {
                                            required: !defaultMaxIssues,
                                        })}
                                        value={defaultMaxIssues}
                                        defaultValue={defaultMaxIssues}
                                        onChange={handleMaxIssuesChange}
                                        type='number'
                                        isDisabled={isSubmitting || isImportRunning}
                                    />
                                    {errors["maxIssues"] && (
                                        <ErrorMessage>{messages.maxIssuesPerAppError}</ErrorMessage>
                                    )}
                                </Box>
                                <>
                                    {isOpen && (
                                        <SectionMessage appearance="success">
                                            <Text>{messages.issuesImportedSuccess}</Text>
                                        </SectionMessage>
                                    )}
                                </>
                                <>
                                    {isImportProgress && (
                                        <SectionMessage title="Import, In progress!" appearance="discovery">
                                            <Text>{importStatus}</Text>
                                        </SectionMessage>
                                    )}
                                </>
                                <>
                                    {isImportRunning && (
                                        <SectionMessage title="Import, In progress" appearance="discovery">
                                            <Text>Your issues are being imported...</Text>
                                            {importTime ? <Text>Expected completion time: {(new Date(parseInt(importTime))).toLocaleTimeString()}</Text> : ''}
                                            <Text>Imported {currentIssueCount}/{appCount * defaultMaxIssues}</Text>
                                            <Text>
                                                <ProgressBar
                                                    appearance="default"
                                                    value={currentIssueCount / (appCount * defaultMaxIssues)}
                                                />
                                            </Text>
                                        </SectionMessage>
                                    )}
                                </>
                                <>
                                    {isError && (
                                        <SectionMessage title="Error!" appearance="error">
                                            <Text>{importStatus}</Text>
                                        </SectionMessage>

                                    )}
                                </>
                                <>
                                    {isWarning && (
                                        <SectionMessage title="No issues found" appearance="information">
                                        </SectionMessage>
                                    )}
                                </>
                            </Stack>

                        </FormSection>
                        <FormFooter align='start'>
                            <Button appearance="primary" isDisabled={isSubmitting || isImportRunning} type="submit">
                                Import now {isSubmitting || isImportRunning ? <Spinner appearance='inherit' size={'medium'} /> : ''}
                            </Button>
                        </FormFooter>
                    </Form >
                }
            </Box >
        </>
    )
}



export default OneTimeImport