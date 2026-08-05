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
    Select,
    Checkbox,
    Button,
    Box,
    Stack,
    Label,
    SectionMessage,
    HelperMessage,
    ErrorMessage,
    Text,
    Inline,
    Lozenge,
    Strong,
    Spinner,
    Toggle,
    Heading,
    ModalHeader,
    Modal,
    ModalTransition,
    ModalTitle,
    ModalBody,
    ModalFooter

} from '@forge/react';
import { invoke, requestJira } from '@forge/bridge';
import { TableCell, TableHeader, TableInputCell, TableRow } from './components/table'
import DefaultLoader from './components/defaultLoader';
import { storageKeys } from '../appConstants';
import { useAppContext } from './context/appContext';
import messages from './messages';


const ImportConfiguration = ({ refreshConfigFlag, isCredsExpired }) => {
    const [isConfigSaved, setConfigSaved] = useState(false);
    const [applications, setApplications] = useState([]);
    const [appscanPolicies, setAppscanpolicies] = useState([]);
    const [projects, setProjects] = useState([]);
    const [issueTypes, setIssueTypes] = useState([]);

    const [selectedApplications, setSelctedApplications] = useState([]);
    const [policyIds, setPolicyIds] = useState();
    const [issueStates, setIssueStates] = useState(['Open']);
    const [severity, setSeverity] = useState(["Critical", "High", "Medium", "Low", "Informational"]);
    const [selectedScanTypes, setSelectedScanTypes] = useState(['DAST', 'SAST', 'SCA', 'IAST']);
    const [selectedProject, setSelectedProject] = useState();
    const [selectedIssueType, setSelectedIssueType] = useState();



    const { handleSubmit, register, getFieldId, formState } = useForm();
    const { errors, isSubmitting } = formState;

    const [showLoader, setShowLoader] = useState(true);
    const [issueTypeLoading, setIssueTypeLoading] = useState(false);

    const { configStorage, setConfigStorage } = useAppContext();
    const [isChecked, setIsChecked] = useState(false);

    const [isOpen, setIsOpen] = useState(false);
    const openModal = () => setIsOpen(true);
    const closeModal = () => setIsOpen(false);
    const disableBidirectional = () => { setIsOpen(false); setIsChecked(false); }
    const [jiraPriority, setJiraPriority] = useState([]);
    const [selectedSeverityCritical, setSelectedSeverityCritical] = useState();
    const [selectedSeverityHigh, setSelectedSeverityHigh] = useState();
    const [selectedSeverityMedium, setSelectedSeverityMedium] = useState();
    const [selectedSeverityLow, setSelectedSeverityLow] = useState();
    const [selectedSeverityInfo, setSelectedSeverityInfo] = useState();
    //status management
    const [statusesLoading, setStatusesLoading] = useState(false);
    const [resolutionsLoading, setResolutionsLoading] = useState(false);
    const [isManual, setIsManual] = useState(false);
    const [jiraStatus, setJiraStatuses] = useState([]);
    const [jiraResolution, setJiraResolutions] = useState([]);
    const [selectedJiraFixedStatus, setSelectedJiraFixedStatus] = useState();
    const [selectedJiraFixedResolution, setSelectedJiraFixedResolution] = useState();
    const [selectedJiraNoiseStatus, setSelectedJiraNoiseStatus] = useState();
    const [selectedJiraNoiseResolution, setSelectedJiraNoiseResolution] = useState();
    const [selectedJiraInProgressStatus, setSelectedJiraInProgressStatus] = useState();
    const [selectedJiraInProgressResolution, setSelectedJiraInProgressResolution] = useState();
    const [selectedJiraReopenedStatus, setSelectedJiraReopenedStatus] = useState();
    const [selectedJiraReopenedResolution, setSelectedJiraReopenedResolution] = useState();
    const [selectedJiraOpenStatus, setSelectedJiraOpenStatus] = useState();
    const [selectedJiraOpenResolution, setSelectedJiraOpenResolution] = useState();
    const [selectedJiraPassedStatus, setSelectedJiraPassedStatus] = useState();
    const [selectedJiraPassedResolution, setSelectedJiraPassedResolution] = useState();
    const [duplicateMappingError, setDuplicateMappingError] = useState('');

    useEffect(() => {
        const initializeImportConfig = async () => {
            setShowLoader(true);
            const projects = await fetchProjects();
            const projectOptionsData = projects.map((project) => ({
                label: project.name,
                value: project.id
            }
            ));
            setProjects(projectOptionsData);

            const priority = await fetchPriority();
            const priorityOptionsData = priority.map((priority) => ({
                label: priority.name,
                value: priority.name
            }
            ));
            setJiraPriority(priorityOptionsData);


            const applications = await fetchApplications();
            applications.sort((a, b) => (a.Name > b.Name) ? 1 : -1);
            applications.sort((a, b) => {
                if (a.Name === "All") return -1;
                if (b.Name === "All") return 1;
                return (a.Name > b.Name) ? 1 : -1;
            });
            const applicationOptionsdata = applications.map((application) => ({
                label: application.Name,
                value: application.Id
            }
            ));
            setApplications(applicationOptionsdata);

            const policies = await fetchAppscanpolicies();
            const policyOptionsdata = policies.map((policy) => ({
                label: policy.Name,
                value: policy.Id
            }
            ));
            setAppscanpolicies(policyOptionsdata);
            //state management bidirectional
            const resolutionsData = await fetchResolutions();

            const resolutionOptionsData = resolutionsData.values.map((resolutions) => ({
                    label: resolutions.name,
                    value: resolutions.name
                }
            ));
            const resolutionOptionsList = [
                {
                    label: "N/A",
                    value: ""
                },
                ...resolutionOptionsData
            ]

            setJiraResolutions(resolutionOptionsList);

            await updateImportConfiguration(applicationOptionsdata,priorityOptionsData);
            setShowLoader(false);
        }

        initializeImportConfig();

    }, [refreshConfigFlag]);

    useEffect(() => {
        const fetchIssueTypesByProject = async () => {
            setIssueTypeLoading(true);
            if (selectedProject && Object.keys(selectedProject).length != 0) {
                const issueTypedata = await fetchIssueTypes();
                
                const issueTypeOptionData = issueTypedata.filter(x=>x.name!='Sub-task').filter(x=>x.name!='Subtask').map((issue) => ({
                    label: issue.name,
                    value: issue.id
                }));

                setIssueTypes(issueTypeOptionData);
            }
            setIssueTypeLoading(false);
        }
        fetchIssueTypesByProject();
    }, [selectedProject])

    useEffect(() => {
        const fetchStatusesByIssue = async () => {
            setStatusesLoading(true);
            if (selectedIssueType && Object.keys(selectedIssueType).length != 0) {
                const statusesData = await fetchStatuses();

                const statusesOptionData = statusesData.find(x=>x.name===selectedIssueType.label).statuses.map((statuses) => ({
                    label: statuses.name,
                    value: statuses.name

                }));

                const statusOptionsList = [
                    {
                        label: "N/A",
                        value: ""
                    },
                    ...statusesOptionData
                ];
                setJiraStatuses(statusOptionsList);
            }
            setStatusesLoading(false);
        }
        fetchStatusesByIssue();
    }, [selectedIssueType])

    const updateImportConfiguration = async (applicationOptionsdata,priorityOptionsData) => {

        const config = await invoke('storage', { storageKey: storageKeys.importConfiguration, type: "GET" });
        setConfigStorage(config);
        console.log('import configuration from storage', config);
        if (config && Object.keys(config).length != 0) {
            const defaultSelectedApps = config.applicationId.filter((a) => applicationOptionsdata.some((y) => y.value == a.value));
            setSelctedApplications(defaultSelectedApps);
            setIssueStates(config.issuesStates)
            setSeverity(config.issueSeverityFilter);
            setSelectedScanTypes(config.scanType);
            setSelectedProject(config.selectedProject);
            setSelectedIssueType(config.selectedIssueType);
            setIssueStates(config.issuesStates);
            setSelectedJiraFixedStatus(config.jiraFixedStatus);
            setSelectedJiraFixedResolution(config.jiraFixedResolution);
            setSelectedJiraNoiseStatus(config.jiraNoiseStatus);
            setSelectedJiraNoiseResolution(config.jiraNoiseResolution);
            setSelectedJiraInProgressStatus(config.jiraInProgressStatus);
            setSelectedJiraInProgressResolution(config.jiraInProgressResolution);
            setSelectedJiraReopenedStatus(config.jiraReopenedStatus);
            setSelectedJiraReopenedResolution(config.jiraReopenedResolution);
            setSelectedJiraOpenStatus(config.jiraOpenStatus);
            setSelectedJiraOpenResolution(config.jiraOpenResolution);
            setSelectedJiraPassedStatus(config.jiraPassedStatus);
            setSelectedJiraPassedResolution(config.jiraPassedResolution);
            if(priorityOptionsData.some(x=>x.value==config.jiraSeverityCritical?.value)){
                setSelectedSeverityCritical(config.jiraSeverityCritical);
            }
            if(priorityOptionsData.some(x=>x.value==config.jiraSeverityHigh?.value)){
                setSelectedSeverityHigh(config.jiraSeverityHigh);
            }
            if(priorityOptionsData.some(x=>x.value==config.jiraSeverityLow?.value)){
                setSelectedSeverityLow(config.jiraSeverityLow);
            }
            if(priorityOptionsData.some(x=>x.value==config.jiraSeverityMedium?.value)){
                setSelectedSeverityMedium(config.jiraSeverityMedium);
            }
            if(priorityOptionsData.some(x=>x.value==config.jiraSeverityInformational?.value)){
                setSelectedSeverityInfo(config.jiraSeverityInformational);
            }
            setPolicyIds(config.policyIds);
            setIsChecked(config.biDirectionalEnabled);
            setIsManual(config.manualMappingEnabled);
        }
    }


    const fetchApplications = async () => {
        try {
            const credentials = await invoke('secretStorage', { storageKey: storageKeys.credentials, type: "GET" });
            if (credentials && Object.keys(credentials).length != 0) {
                const authresponse = await invoke('login', { url: credentials.url, keyId: credentials.keyId, keySecret: credentials.keySecret });
                if (!authresponse.hasOwnProperty("Message")) {
                    const authorizationHeader = `Bearer ${authresponse.Token}`;
                    let fetchAllAppsResponseJson = await invoke('fetchAllApps', { fetchAllAppsURL: credentials.url, authorizationHeader: authorizationHeader });
                    fetchAllAppsResponseJson.Items.push({ "Name": "All", "Id": "all" });
                    return fetchAllAppsResponseJson.Items;
                }
            }
            return [];
        } catch (error) {
            console.error("Error fetching applications:", error);
            return [];
        }
    };


    const fetchAppscanpolicies = async () => {
        try {
            const credentials = await invoke('secretStorage', { storageKey: storageKeys.credentials, type: "GET" });
            if (credentials && Object.keys(credentials).length != 0) {
                const authresponse = await invoke('login', { url: credentials.url, keyId: credentials.keyId, keySecret: credentials.keySecret });
                if (!authresponse.hasOwnProperty("Message")) {
                    const authorizationHeader = `Bearer ${authresponse.Token}`;
                    let fetchAllPoliciesJson = await invoke('fetchAllPolicies', { fetchAllPoliciesURL: credentials.url, authorizationHeader: authorizationHeader });
                   
                    return fetchAllPoliciesJson.Items;
                }
            }
            return [];
        } catch (error) {
            console.error("Error fetching policies:", error);
            return [];
        }
    };

    const fetchProjects = async () => {
        try {

            const response = await requestJira(`/rest/api/3/project`);
            const projectsData = await response.json();
            return projectsData;
        } catch (error) {
            console.error("Error fetching projects:", error);
        }
    };

    const fetchPriority = async () => {
        try {
            const response = await requestJira(`/rest/api/2/priority`);
            const priorityData = await response.json();
            return priorityData;
        }
        catch (error) {
            console.error("Error fetching priority:", error);
        }
    }


    const fetchIssueTypes = async () => {
        try {
            const response = await requestJira(`/rest/api/3/issuetype/project?projectId=${selectedProject.value}`);
            const issueTypesData = await response.json();
            return issueTypesData;
        } catch (error) {
            console.error("Error fetching issueTypesData:", error);
        }
    };

    const fetchStatuses = async () => {
        try {
            const response = await requestJira(`/rest/api/3/project/${selectedProject.value}/statuses`);
            const statusesData = await response.json();
            return statusesData;
        } catch (error) {
            console.error("Error fetching statusesData:", error);
            return null;
        }
    };

    const fetchResolutions = async () => {
        try {
            console.log("fetching resolutions")
            const response = await requestJira(`/rest/api/3/resolution/search`);
            const resolutionsData = await response.json();
            return resolutionsData;
        } catch (error) {
            console.error("Error fetching resolutionsData:", error);
        }
    };

    const checkDuplicateMappings = (overrides = {}) => {
        const getVal = (key, selected) => overrides[key] !== undefined ? overrides[key] : selected;
        const mappings = [
            { name: 'Fixed', status: getVal('fixedStatus', selectedJiraFixedStatus)?.value, resolution: getVal('fixedResolution', selectedJiraFixedResolution)?.value || '' },
            { name: 'Noise', status: getVal('noiseStatus', selectedJiraNoiseStatus)?.value, resolution: getVal('noiseResolution', selectedJiraNoiseResolution)?.value || '' },
            { name: 'In Progress', status: getVal('inProgressStatus', selectedJiraInProgressStatus)?.value, resolution: getVal('inProgressResolution', selectedJiraInProgressResolution)?.value || '' },
            { name: 'Reopened', status: getVal('reopenedStatus', selectedJiraReopenedStatus)?.value, resolution: getVal('reopenedResolution', selectedJiraReopenedResolution)?.value || '' },
            { name: 'Open', status: getVal('openStatus', selectedJiraOpenStatus)?.value, resolution: getVal('openResolution', selectedJiraOpenResolution)?.value || '' },
            { name: 'Passed', status: getVal('passedStatus', selectedJiraPassedStatus)?.value, resolution: getVal('passedResolution', selectedJiraPassedResolution)?.value || '' },
        ].filter(m => m.status && m.status.trim() !== '');

        for (let i = 0; i < mappings.length; i++) {
            for (let j = i + 1; j < mappings.length; j++) {
                if (mappings[i].status === mappings[j].status && mappings[i].resolution === mappings[j].resolution) {
                    setDuplicateMappingError(
                        `Duplicate mapping: "${mappings[i].name}" and "${mappings[j].name}" have the same Jira status and resolution. Please use distinct mappings.`
                    );
                    return true;
                }
            }
        }
        setDuplicateMappingError('');
        return false;
    };

    const submitForm = async (formData) => {
        setConfigSaved(false);

        if (isManual && isChecked && checkDuplicateMappings()) {
            return;
        }

        await saveFormData();
        setConfigSaved(true);
    };



    const saveFormData = async () => {
        try {
            const data = {
                jiraFixedStatus: selectedJiraFixedStatus,
                jiraFixedResolution: selectedJiraFixedResolution,
                jiraNoiseStatus: selectedJiraNoiseStatus,
                jiraNoiseResolution: selectedJiraNoiseResolution,
                jiraInProgressStatus: selectedJiraInProgressStatus,
                jiraInProgressResolution: selectedJiraInProgressResolution,
                jiraReopenedStatus: selectedJiraReopenedStatus,
                jiraReopenedResolution: selectedJiraReopenedResolution,
                jiraOpenStatus: selectedJiraOpenStatus,
                jiraOpenResolution: selectedJiraOpenResolution,
                jiraPassedStatus: selectedJiraPassedStatus,
                jiraPassedResolution: selectedJiraPassedResolution,
                jiraSeverityLow: selectedSeverityLow,
                jiraSeverityHigh: selectedSeverityHigh,
                jiraSeverityCritical: selectedSeverityCritical,
                jiraSeverityMedium: selectedSeverityMedium,
                jiraSeverityInformational: selectedSeverityInfo,
                applicationId: selectedApplications,
                issuesStates: issueStates,
                issueSeverityFilter: severity,
                scanType: selectedScanTypes,
                selectedProject: selectedProject,
                selectedIssueType: selectedIssueType,
                policyIds: policyIds,
                biDirectionalEnabled: isChecked,
                manualMappingEnabled: isManual
            }
            console.log('data to be submitted', data);

            await invoke('storage', { formData: data, storageKey: storageKeys.importConfiguration, type: "POST" });
            setConfigStorage(data);

            console.log("Form data saved successfully!");
        } catch (error) {
            console.error("Error saving form data:", error);

        }
    }

    const handleApplicationChange = (e) => {
        setSelctedApplications(e);
    }

    const handlePolicyChange = (e) => {
        setPolicyIds(e);
    }

    const handleSelectedProjectChange = (e) => {
        setSelectedProject(e);
    }

    const handleSelectedIssueTypeChange = (e) => {
        setSelectedIssueType(e);
    }

    const handleJiraPriorityCriticalChange = (e) => {
        setSelectedSeverityCritical(e);
    }

    const handleJiraPriorityHighChange = (e) => {
        setSelectedSeverityHigh(e);
    }

    const handleJiraPriorityMediumChange = (e) => {
        setSelectedSeverityMedium(e);
    }

    const handleJiraPriorityLowChange = (e) => {
        setSelectedSeverityLow(e);
    }

    const handleJiraPriorityInfoChange = (e) => {
        setSelectedSeverityInfo(e);
    }
    const handleJiraFixedStatusChange = (e) => {
        setSelectedJiraFixedStatus(e || null);
        if (!e || !e.value) {
            setSelectedJiraFixedResolution({ label: 'N/A', value: '' });
            checkDuplicateMappings({ fixedStatus: e, fixedResolution: { label: 'N/A', value: '' } });
        } else {
            checkDuplicateMappings({ fixedStatus: e });
        }
    }

    const handleJiraFixedResolutionChange = (e) => {
        setSelectedJiraFixedResolution(e);
        checkDuplicateMappings({ fixedResolution: e });
    }

    const handleJiraNoiseStatusChange = (e) => {
        setSelectedJiraNoiseStatus(e);
        if (!e || !e.value) {
            setSelectedJiraNoiseResolution({ label: 'N/A', value: '' });
            checkDuplicateMappings({ noiseStatus: e, noiseResolution: { label: 'N/A', value: '' } });
        } else {
            checkDuplicateMappings({ noiseStatus: e });
        }
    }

    const handleJiraNoiseResolutionChange = (e) => {
        setSelectedJiraNoiseResolution(e);
        checkDuplicateMappings({ noiseResolution: e });
    }

    const handleJiraInProgressStatusChange = (e) => {
        setSelectedJiraInProgressStatus(e);
        if (!e || !e.value) {
            setSelectedJiraInProgressResolution({ label: 'N/A', value: '' });
            checkDuplicateMappings({ inProgressStatus: e, inProgressResolution: { label: 'N/A', value: '' } });
        } else {
            checkDuplicateMappings({ inProgressStatus: e });
        }
    }

    const handleJiraInProgressResolutionChange = (e) => {
        setSelectedJiraInProgressResolution(e);
        checkDuplicateMappings({ inProgressResolution: e });
    }

    const handleJiraReopenedStatusChange = (e) => {
        setSelectedJiraReopenedStatus(e);
        if (!e || !e.value) {
            setSelectedJiraReopenedResolution({ label: 'N/A', value: '' });
            checkDuplicateMappings({ reopenedStatus: e, reopenedResolution: { label: 'N/A', value: '' } });
        } else {
            checkDuplicateMappings({ reopenedStatus: e });
        }
    }

    const handleJiraReopenedResolutionChange = (e) => {
        setSelectedJiraReopenedResolution(e);
        checkDuplicateMappings({ reopenedResolution: e });
    }

    const handleJiraOpenStatusChange = (e) => {
        setSelectedJiraOpenStatus(e);
        if (!e || !e.value) {
            setSelectedJiraOpenResolution({ label: 'N/A', value: '' });
            checkDuplicateMappings({ openStatus: e, openResolution: { label: 'N/A', value: '' } });
        } else {
            checkDuplicateMappings({ openStatus: e });
        }
    }

    const handleJiraOpenResolutionChange = (e) => {
        setSelectedJiraOpenResolution(e);
        checkDuplicateMappings({ openResolution: e });
    }

    const handleJiraPassedStatusChange = (e) => {
        setSelectedJiraPassedStatus(e);
        if (!e || !e.value) {
            setSelectedJiraPassedResolution({ label: 'N/A', value: '' });
            checkDuplicateMappings({ passedStatus: e, passedResolution: { label: 'N/A', value: '' } });
        } else {
            checkDuplicateMappings({ passedStatus: e });
        }
    }

    const handleJiraPassedResolutionChange = (e) => {
        setSelectedJiraPassedResolution(e);
        checkDuplicateMappings({ passedResolution: e });
    }
    const isStatusNA = (status) => !status || !status.value || status.value.trim() === '';
    const dimmedRowStyle = { opacity: '0.5' };

    const onPolicyChange = (e) => {
        setPolicyIds(e.target.value);
    }

    const handleIssueStateChange = (e) => {
        if (e.target.checked) {
            setIssueStates([...issueStates, e.target.value]);
        }
        else {
            setIssueStates(
                issueStates.filter(a => a !== e.target.value)
            );
        }

    }

    const handleSeverityChange = (e) => {
        if (e.target.checked) {
            setSeverity([...severity, e.target.value]);
        }
        else {
            setSeverity(
                severity.filter(a => a !== e.target.value)
            );
        }

    }

    const handleScanTypeChange = (e) => {
        if (e.target.checked) {
            setSelectedScanTypes([...selectedScanTypes, e.target.value]);
        }
        else {
            setSelectedScanTypes(selectedScanTypes.filter(a => a !== e.target.value));
        }
    }

    return (
        <>
            <Box xcss={{
                maxWidth: '600px',
                width: '100%',
                position: 'relative'
            }}>
                {showLoader ? <DefaultLoader /> :
                    <Form onSubmit={handleSubmit(submitForm)}>
                        {isCredsExpired ? <Box xcss={{ marginTop: 'space.100' }} > <SectionMessage appearance="error">
                            <Text>{messages.expiredCredentials}</Text>
                        </SectionMessage>  </Box> : ''}
                        <FormSection>
                            <Box xcss={{ marginBottom: 'space.100' }}>
                                <Heading as="h3">Applications & policies</Heading>
                                <HelperMessage>Select the applications and policies to import findings from.</HelperMessage>
                            </Box>
                            <Stack space="space.100">
                                <Box >
                                    <Label labelFor={getFieldId("applicationId")}>
                                        Applications
                                        <RequiredAsterisk />
                                    </Label>
                                    <Select
                                        appearance='default'
                                        isMulti={true}
                                        isSearchable={true}
                                        {...register("applicationId", {
                                            required: selectedApplications.length == 0,
                                        })}
                                        options={applications.map(({ label, value }) => ({ label, value }))}
                                        value={selectedApplications}
                                        defaultValue={selectedApplications}
                                        onChange={handleApplicationChange}
                                        isDisabled={isSubmitting}
                                    >
                                    </Select>
                                    <HelperMessage>
                                        Select the applications from which to import results. The 'All' option is applicable when the total number of applications is under 200.
                                    </HelperMessage>
                                    {errors["applicationId"] && (
                                        <ErrorMessage>{messages.appFieldError}</ErrorMessage>
                                    )}
                                </Box>

                                <Box >
                                    <Label labelFor={getFieldId("policyId")}>
                                        Policies
                                        <RequiredAsterisk />
                                    </Label>
                                    <Select
                                        appearance='default'
                                        isMulti={true}
                                        isSearchable={true}
                                        {...register("policyId", {
                                            required: appscanPolicies.length == 0,
                                        })}
                                        options={appscanPolicies.map(({ label, value }) => ({ label, value }))}
                                        value={policyIds}
                                        defaultValue={policyIds}
                                        onChange={handlePolicyChange}
                                        isDisabled={isSubmitting}
                                    >
                                    </Select>
                                    <HelperMessage>
                                        Select AppScan policies.
                                    </HelperMessage>
                                    {errors["policyId"] && (
                                        <ErrorMessage>{messages.appFieldError}</ErrorMessage>
                                    )}
                                </Box>
                            </Stack>
                        </FormSection>

                        <FormSection>
                            <Box xcss={{ marginTop: 'space.300', marginBottom: 'space.100' }}>
                                <Heading as="h3">Customize import</Heading>
                                <HelperMessage>Choose which AppScan findings to import based on their status, severity, and scan type.</HelperMessage>
                            </Box>
                            <Stack space="space.100">
                                <Box>

                                    <Text><Strong>Status<RequiredAsterisk /></Strong></Text>
                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="Open"
                                            isRequired={issueStates.length == 0}
                                            isChecked={issueStates.some(x => x == 'Open')}
                                            value={"Open"}
                                            onChange={handleIssueStateChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    <Box xcss={{ maxWidth: '25%' }}>
                                        <Checkbox
                                            label="In progress"
                                            isRequired={issueStates.length == 0}
                                            value={"InProgress"}
                                            isChecked={issueStates.some(x => x == 'InProgress')}
                                            onChange={handleIssueStateChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="Reopened"
                                            isRequired={issueStates.length == 0}
                                            value={"Reopened"}
                                            isChecked={issueStates.some(x => x == 'Reopened')}
                                            onChange={handleIssueStateChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    {issueStates.length == 0 && (
                                        <ErrorMessage>{messages.stateFieldError}</ErrorMessage>
                                    )}
                                </Box>
                                <Box>
                                    <Text><Strong>Severity<RequiredAsterisk /></Strong></Text>

                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="Critical"
                                            isRequired={severity.length == 0}
                                            isChecked={severity.some(x => x == 'Critical')}
                                            value={"Critical"}
                                            onChange={handleSeverityChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="High"
                                            isRequired={severity.length == 0}
                                            value={"High"}
                                            isChecked={severity.some(x => x == 'High')}
                                            onChange={handleSeverityChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="Medium"
                                            isRequired={severity.length == 0}
                                            value={"Medium"}
                                            isChecked={severity.some(x => x == 'Medium')}
                                            onChange={handleSeverityChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="Low"
                                            isRequired={severity.length == 0}
                                            value={"Low"}
                                            isChecked={severity.some(x => x == 'Low')}
                                            onChange={handleSeverityChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="Informational"
                                            isRequired={severity.length == 0}
                                            value={"Informational"}
                                            isChecked={severity.some(x => x == 'Informational')}
                                            onChange={handleSeverityChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    {severity.length == 0 && (
                                        <ErrorMessage>Please select at least one severity</ErrorMessage>
                                    )}
                                </Box>
                                <Box>
                                    <Text><Strong>Scan type<RequiredAsterisk /></Strong></Text>

                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="DAST"
                                            isRequired={selectedScanTypes.length == 0}
                                            isChecked={selectedScanTypes.some(x => x == 'DAST')}
                                            value={"DAST"}
                                            onChange={handleScanTypeChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="SAST"
                                            isRequired={selectedScanTypes.length == 0}
                                            value={"SAST"}
                                            isChecked={selectedScanTypes.some(x => x == 'SAST')}
                                            onChange={handleScanTypeChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="SCA"
                                            isRequired={selectedScanTypes.length == 0}
                                            value={"SCA"}
                                            isChecked={selectedScanTypes.some(x => x == 'SCA')}
                                            onChange={handleScanTypeChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    <Box xcss={{ maxWidth: '10%' }}>
                                        <Checkbox
                                            label="IAST"
                                            isRequired={selectedScanTypes.length == 0}
                                            value={"IAST"}
                                            isChecked={selectedScanTypes.some(x => x == 'IAST')}
                                            onChange={handleScanTypeChange}
                                            isDisabled={isSubmitting}
                                        />
                                    </Box>
                                    {selectedScanTypes.length == 0 && (
                                        <ErrorMessage>{messages.scanTypeFieldError}</ErrorMessage>
                                    )}
                                </Box>
                            </Stack>
                        </FormSection>

                        <FormSection>
                            <Box xcss={{ marginTop: 'space.300', marginBottom: 'space.100' }}>
                                <Heading as="h3">Jira project & work item type</Heading>
                                <HelperMessage>Choose the Jira project and work item type where imported findings will be created.</HelperMessage>
                            </Box>
                            <Stack space="space.100">
                                <Box >
                                    <Label labelFor={getFieldId("selectedProject")}>
                                        Jira project
                                        <RequiredAsterisk />
                                    </Label>
                                    <Select
                                        appearance='default'
                                        {...register("selectedProject", {
                                            required: !selectedProject || Object.keys(selectedProject).length == 0,
                                        })}
                                        options={projects.map(({ label, value }) => ({ label, value }))}
                                        value={selectedProject}
                                        defaultValue={selectedProject}
                                        onChange={handleSelectedProjectChange}
                                        isDisabled={isSubmitting}
                                    >
                                    </Select>
                                    <HelperMessage>
                                    AppScan relies on the 'Priority' field in your Jira project to synchronize the security finding severity level.
                                    Please ensure the 'Priority' field is available in the designated Jira project.
                                    </HelperMessage>
                                    {errors["selectedProject"] && (
                                        <ErrorMessage>{messages.projectFieldError}</ErrorMessage>
                                    )}
                                </Box>
                                <Box >
                                    <Label labelFor={getFieldId("selectedIssueType")}>
                                        Jira work item type
                                        <RequiredAsterisk />
                                    </Label>
                                    <Select
                                        appearance='default'
                                        {...register("selectedIssueType", {
                                            required: !selectedIssueType || Object.keys(selectedIssueType).length == 0,
                                        })}
                                        options={issueTypes.map(({ label, value }) => ({ label, value }))}
                                        value={selectedIssueType}
                                        defaultValue={selectedIssueType}
                                        onChange={handleSelectedIssueTypeChange}
                                        isDisabled={isSubmitting}
                                        isLoading={issueTypeLoading}
                                    >
                                    </Select>
                                    {errors["selectedIssueType"] && (
                                        <ErrorMessage>{messages.issueTypeFieldError}</ErrorMessage>
                                    )}
                                </Box>
                            </Stack>
                        </FormSection>

                        <FormSection>
                            <Box xcss={{ marginTop: 'space.300', marginBottom: 'space.100' }}>
                                <Heading as="h3">Status management</Heading>
                                <HelperMessage>Configure automatic status synchronization between Jira and AppScan.</HelperMessage>
                            </Box>
                            <Stack space="space.100">
                                <Box>
                                    <Checkbox
                                        value="bidirectional"
                                        label="Jira work items marked as done are automatically fixed in AppScan"
                                        isChecked={isChecked}
                                        onChange={() => {
                                            setIsChecked((prev) => !prev);
                                            if (!isChecked) {
                                                setIsOpen(true);
                                            }
                                        }}
                                    />
                                </Box>

                                <Box>
                                    <ModalTransition>
                                        {isOpen && (
                                            <Modal onClose={closeModal}>
                                                <ModalHeader>
                                                    <ModalTitle>Status management</ModalTitle>
                                                </ModalHeader>
                                                <ModalBody>
                                                    <Text>
                                                        Selecting this will enable automatic status management. Jira work items marked as done are automatically fixed in AppScan.
                                                    </Text>
                                                </ModalBody>
                                                <ModalFooter>
                                                    <Button appearance="subtle" onClick={disableBidirectional}>
                                                        Cancel
                                                    </Button>
                                                    <Button appearance="primary" onClick={closeModal}>
                                                        Confirm
                                                    </Button>
                                                </ModalFooter>
                                            </Modal>
                                        )}
                                    </ModalTransition>

                                </Box>
                                {isChecked && (<Box xcss={{ paddingTop: 'space.100' }}>
                                        <Inline alignBlock="center" space="space.100">
                                            <Toggle
                                                id="custom-status-mapping"
                                                isChecked={isManual}
                                                onChange={() => {
                                                    setIsManual((prev) => !prev);
                                                }}
                                            />
                                            <Text>Custom status mapping</Text>
                                        </Inline>
                                        <HelperMessage>
                                            When off, only "Done" in Jira maps to "Fixed" in AppScan. Turn on to define your own mappings below.
                                        </HelperMessage>
                                    </Box>
                                ) /* isChecked */}

                                {/* Begin Jira status mapping */}
                                {/* Resolved has Fixed */}
                                {/* Open, In progress, (Close has Noise Fixed Passed)  */}
                                {/* <Table headers={headers} rows={rows} /> */}
                                {isManual && isChecked && (<Stack xcss={{ paddingTop: 'space.200', paddingBottom: 'space.100' }}>
                                        {/* Table headers */}
                                        <TableRow>
                                            <TableHeader ><Text><Strong>AppScan status</Strong></Text></TableHeader>
                                            <TableHeader ><Text><Strong>Jira status</Strong></Text></TableHeader>
                                            <TableHeader ><Text><Strong>Jira resolution</Strong></Text></TableHeader>
                                        </TableRow>
                                        {/* Table rows */}

                                        <TableRow xcss={isStatusNA(selectedJiraFixedStatus) ? dimmedRowStyle : undefined}>

                                            <TableCell>Fixed</TableCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    {...register("statusFixed")}
                                                    options={jiraStatus}
                                                    value={selectedJiraFixedStatus}
                                                    onChange={handleJiraFixedStatusChange}
                                                    isDisabled={isSubmitting}
                                                    isLoading={statusesLoading}
                                                ></Select>
                                            </TableInputCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    {...register("resolutionFixed")}
                                                    options={jiraResolution || ''}
                                                    value={selectedJiraFixedResolution || ''}
                                                    defaultValue={selectedJiraFixedResolution}
                                                    onChange={handleJiraFixedResolutionChange}
                                                    isDisabled={isSubmitting || isStatusNA(selectedJiraFixedStatus)}
                                                ></Select>
                                            </TableInputCell>
                                        </TableRow>
                                        <TableRow xcss={isStatusNA(selectedJiraNoiseStatus) ? dimmedRowStyle : undefined}>
                                            <TableCell>Noise</TableCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    {...register("statusNoise")}
                                                    options={jiraStatus}
                                                    value={selectedJiraNoiseStatus}
                                                    defaultValue={selectedJiraNoiseStatus}
                                                    onChange={handleJiraNoiseStatusChange}
                                                    isDisabled={isSubmitting}
                                                    isLoading={statusesLoading}
                                                ></Select>
                                            </TableInputCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    {...register("resolutionNoise")}
                                                    options={jiraResolution}
                                                    value={selectedJiraNoiseResolution}
                                                    defaultValue={selectedJiraNoiseResolution}
                                                    onChange={handleJiraNoiseResolutionChange}
                                                    isDisabled={isSubmitting || isStatusNA(selectedJiraNoiseStatus)}
                                                ></Select>
                                            </TableInputCell>
                                        </TableRow>
                                        <TableRow xcss={isStatusNA(selectedJiraInProgressStatus) ? dimmedRowStyle : undefined}>
                                            <TableCell>In progress</TableCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    {...register("statusInProgress")}
                                                    options={jiraStatus}
                                                    value={selectedJiraInProgressStatus}
                                                    defaultValue={selectedJiraInProgressStatus}
                                                    onChange={handleJiraInProgressStatusChange}
                                                    isDisabled={isSubmitting}
                                                    isLoading={statusesLoading}
                                                ></Select>
                                            </TableInputCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    options={jiraResolution}
                                                    value={selectedJiraInProgressResolution || ''}
                                                    defaultValue={selectedJiraInProgressResolution}
                                                    onChange={handleJiraInProgressResolutionChange}
                                                    isDisabled={isSubmitting || isStatusNA(selectedJiraInProgressStatus)}
                                                ></Select>
                                            </TableInputCell>
                                        </TableRow>
                                        <TableRow xcss={isStatusNA(selectedJiraReopenedStatus) ? dimmedRowStyle : undefined}>
                                            <TableCell>Reopened</TableCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    {...register("statusReopened")}
                                                    options={jiraStatus}
                                                    value={selectedJiraReopenedStatus}
                                                    defaultValue={selectedJiraReopenedStatus}
                                                    onChange={handleJiraReopenedStatusChange}
                                                    isDisabled={isSubmitting}
                                                ></Select>
                                            </TableInputCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    options={jiraResolution}
                                                    value={selectedJiraReopenedResolution || ''}
                                                    defaultValue={selectedJiraReopenedResolution}
                                                    onChange={handleJiraReopenedResolutionChange}
                                                    isDisabled={isSubmitting || isStatusNA(selectedJiraReopenedStatus)}
                                                ></Select>
                                            </TableInputCell>
                                        </TableRow>
                                        <TableRow xcss={isStatusNA(selectedJiraOpenStatus) ? dimmedRowStyle : undefined}>
                                            <TableCell>Open</TableCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    options={jiraStatus}
                                                    value={selectedJiraOpenStatus}
                                                    defaultValue={selectedJiraOpenStatus}
                                                    onChange={handleJiraOpenStatusChange}
                                                    isDisabled={isSubmitting}
                                                    isLoading={statusesLoading}
                                                ></Select>
                                            </TableInputCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    options={jiraResolution}
                                                    value={selectedJiraOpenResolution || ''}
                                                    defaultValue={selectedJiraOpenResolution}
                                                    onChange={handleJiraOpenResolutionChange}
                                                    isDisabled={isSubmitting || isStatusNA(selectedJiraOpenStatus)}
                                                ></Select>
                                            </TableInputCell>
                                        </TableRow>
                                        <TableRow xcss={isStatusNA(selectedJiraPassedStatus) ? dimmedRowStyle : undefined}>
                                            <TableCell>Passed</TableCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    options={jiraStatus}
                                                    value={selectedJiraPassedStatus}
                                                    defaultValue={selectedJiraPassedStatus}
                                                    onChange={handleJiraPassedStatusChange}
                                                    isDisabled={isSubmitting}
                                                    isLoading={statusesLoading}
                                                ></Select>
                                            </TableInputCell>
                                            <TableInputCell>
                                                <Select
                                                    appearance='default'
                                                    options={jiraResolution}
                                                    value={selectedJiraPassedResolution || ''}
                                                    defaultValue={selectedJiraPassedResolution}
                                                    onChange={handleJiraPassedResolutionChange}
                                                    isDisabled={isSubmitting || isStatusNA(selectedJiraPassedStatus)}
                                                ></Select>
                                            </TableInputCell>
                                        </TableRow>

                                    </Stack>
                                ) /* isManual */}
                                {duplicateMappingError && (
                                    <SectionMessage appearance="error">
                                        <Text>{duplicateMappingError}</Text>
                                    </SectionMessage>
                                )}
                                {/* End Jira status mapping */}
                            </Stack>
                        </FormSection>

                        <FormSection>
                            <Box xcss={{ marginTop: 'space.300', marginBottom: 'space.100' }}>
                                <Heading as="h3">Severity mapping<RequiredAsterisk /></Heading>
                                <HelperMessage>Map each AppScan severity level to a Jira priority. All five mappings are required.</HelperMessage>
                            </Box>

                            <Stack space="space.100">
                                {/* <Table headers={headers} rows={rows} /> */}
                                <Stack>
                                    {/* Table headers */}
                                    <TableRow>
                                        <TableHeader ><Text><Strong>AppScan severity</Strong></Text></TableHeader>
                                        <TableHeader ><Text><Strong>Jira priority</Strong></Text></TableHeader>
                                    </TableRow>
                                    {/* Table rows */}

                                    <TableRow>

                                        <TableCell >Critical</TableCell>
                                        <TableInputCell>
                                            <Select
                                                appearance='default'
                                                {...register("severityCritical", {
                                                    required: !selectedSeverityCritical || Object.keys(selectedSeverityCritical).length == 0,
                                                })}
                                                options={jiraPriority}
                                                value={selectedSeverityCritical}
                                                defaultValue={selectedSeverityCritical}
                                                onChange={handleJiraPriorityCriticalChange}
                                                isDisabled={isSubmitting}
                                            ></Select>
                                        </TableInputCell>

                                    </TableRow>
                                    <TableRow>

                                        <TableCell >High</TableCell>
                                        <TableInputCell >
                                            <Select
                                                appearance='default'
                                                {...register("severityHigh", {
                                                    required: !selectedSeverityHigh || Object.keys(selectedSeverityHigh).length == 0,
                                                })}
                                                options={jiraPriority}
                                                value={selectedSeverityHigh}
                                                defaultValue={selectedSeverityHigh}
                                                onChange={handleJiraPriorityHighChange}
                                                isDisabled={isSubmitting}
                                            ></Select>
                                        </TableInputCell>

                                    </TableRow>
                                    <TableRow>

                                        <TableCell >Medium</TableCell>
                                        <TableInputCell >
                                            <Select
                                                appearance='default'
                                                {...register("severityMedium", {
                                                    required: !selectedSeverityMedium || Object.keys(selectedSeverityMedium).length == 0,
                                                })}
                                                options={jiraPriority}
                                                value={selectedSeverityMedium}
                                                defaultValue={selectedSeverityMedium}
                                                onChange={handleJiraPriorityMediumChange}
                                                isDisabled={isSubmitting}
                                            ></Select>
                                        </TableInputCell>

                                    </TableRow>
                                    <TableRow>

                                        <TableCell >Low</TableCell>
                                        <TableInputCell >
                                            <Select
                                                appearance='default'
                                                {...register("severityLow", {
                                                    required: !selectedSeverityLow || Object.keys(selectedSeverityLow).length == 0,
                                                })}
                                                options={jiraPriority}
                                                value={selectedSeverityLow}
                                                defaultValue={selectedSeverityLow}
                                                onChange={handleJiraPriorityLowChange}
                                                isDisabled={isSubmitting}
                                            ></Select>
                                        </TableInputCell>

                                    </TableRow>
                                    <TableRow>

                                        <TableCell >Informational</TableCell>
                                        <TableInputCell >
                                            <Select
                                                appearance='default'
                                                {...register("severityInfo", {
                                                    required: !selectedSeverityInfo || Object.keys(selectedSeverityInfo).length == 0,
                                                })}
                                                options={jiraPriority}
                                                value={selectedSeverityInfo}
                                                defaultValue={selectedSeverityInfo}
                                                onChange={handleJiraPriorityInfoChange}
                                                isDisabled={isSubmitting}
                                            ></Select>
                                        </TableInputCell>

                                    </TableRow>

                                </Stack>
                            </Stack>
                        </FormSection>
                        <>
                            {isConfigSaved && (
                                <SectionMessage appearance="success">
                                    <Text>{messages.importConfigSaveSuccess}</Text>
                                </SectionMessage>
                            )}
                        </>
                        <FormFooter align='start'>
                            <Button appearance="primary" isDisabled={isSubmitting || !!duplicateMappingError} type="submit">
                                Save configuration {isSubmitting ? <Spinner appearance='inherit' size={'medium'} /> : ''}
                            </Button>
                        </FormFooter>
                    </Form >
                }
            </Box>

        </>
    )
}


export default ImportConfiguration
