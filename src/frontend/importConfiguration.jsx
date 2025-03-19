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

    const submitForm = async (formData) => {
        setConfigSaved(false);
        await saveFormData();
        setConfigSaved(true);
    };



    const saveFormData = async () => {
        try {
            const data = {
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
                biDirectionalEnabled: isChecked
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
                width: '35%',
                position: 'relative'
            }}>
                {showLoader ? <DefaultLoader /> :
                    <Form onSubmit={handleSubmit(submitForm)}>
                        {isCredsExpired ? <Box xcss={{ marginTop: 'space.100' }} > <SectionMessage appearance="error">
                            <Text>{messages.expiredCredentials}</Text>
                        </SectionMessage>  </Box> : ''}
                        <FormSection>
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

                                <Box xcss={{ marginBottom: 'space.100', marginTop: 'space.200' }} >

                                    <Heading as="h3">
                                        Customize issue import
                                    </Heading>
                                </Box>
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
                                    AppScan relies on the 'Priority' field in your Jira project to synchronize the security issue severity level.
                                    Please ensure the 'Priority' field is available in the designated Jira project.
                                    </HelperMessage>
                                    {errors["selectedProject"] && (
                                        <ErrorMessage>{messages.projectFieldError}</ErrorMessage>
                                    )}
                                </Box>
                                <Box >
                                    <Label labelFor={getFieldId("selectedIssueType")}>
                                        Jira issue type
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


                                <Box xcss={{ paddingTop: 'space.200', paddingBottom: 'space.100' }} >
                                    <Text><Strong>Status management</Strong></Text>
                                    <Checkbox
                                        value="bidirectional"
                                        label="Issues marked as done in Jira are automatically marked as fixed in AppScan"
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
                                                        Selecting this will enable automatic status management. Issues marked as done in <Strong>Jira</Strong> are automatically marked as fixed in <Strong>AppScan</Strong>.
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


                                <Box xcss={{ marginBottom: 'space.100' }} >

                                    <Heading as="h3">
                                        AppScan Jira severity mapping<RequiredAsterisk />
                                    </Heading>
                                </Box>

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


                                <>
                                    {isConfigSaved && (
                                        <SectionMessage appearance="success">
                                            <Text>{messages.importConfigSaveSuccess}</Text>
                                        </SectionMessage>
                                    )}
                                </>
                            </Stack>
                        </FormSection>
                        <FormFooter align='start'>
                            <Button appearance="primary" isDisabled={isSubmitting} type="submit">
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
