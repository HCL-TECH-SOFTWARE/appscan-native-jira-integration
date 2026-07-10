/*
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
 */
import { storageKeys } from '../appConstants';
import api, { route, fetch, storage } from "@forge/api";
/**
 * This trigger is invoked when an issue is updated in Jira
 *
 */
export const issueUpdateTrigger = async function webtriggerhandler(event) {

    console.log("issueUpdateTrigger called");
    const formData = await storage.get(storageKeys.importConfiguration);
    if (!formData || Object.keys(formData).length === 0) {
        console.error('Import configuration is not set, please provide the configuration!');
        return;
    }

    const biDirectionalEnabled = formData.biDirectionalEnabled;
    const manualMappingEnabled = formData.manualMappingEnabled;

    if (!biDirectionalEnabled) {
        console.log("Bi-directional sync is not enabled");
        return;
    }

    const jiraFixedStatus = formData.jiraFixedStatus;
    const jiraFixedResolution = formData.jiraFixedResolution;
    const jiraNoiseStatus = formData.jiraNoiseStatus;
    const jiraNoiseResolution = formData.jiraNoiseResolution;
    const jiraInProgressStatus = formData.jiraInProgressStatus;
    const jiraReopenedStatus = formData.jiraReopenedStatus;

    const issueKey = event && event.issue ? event.issue.key : undefined;
    const currentStatusName = event && event.issue && event.issue.fields && event.issue.fields.status
        ? event.issue.fields.status.name
        : undefined;
    const changedItems = event && event.changelog && event.changelog.items ? event.changelog.items : [];
    const statusChange = changedItems.find((item) => item.field === 'status');
    const resolutionChange = changedItems.find((item) => item.field === 'resolution');

    let updatedStatus;

    if (!manualMappingEnabled) {
        if (currentStatusName !== 'Done') {
            console.log(`Default sync mode skipped for Jira issue ${issueKey || 'unknown'}: current status is ${currentStatusName || 'unknown'}`);
            return;
        }

        updatedStatus = {
            Name: 'Fixed',
            Value: 'fixed'
        };
    } else {
        const manualStatuses = [
            jiraFixedStatus && jiraFixedStatus.value,
            jiraNoiseStatus && jiraNoiseStatus.value,
            jiraInProgressStatus && jiraInProgressStatus.value,
            jiraReopenedStatus && jiraReopenedStatus.value
        ].filter(Boolean);

        if (!manualStatuses.includes(currentStatusName)) {
            console.log(`Manual sync mode skipped for Jira issue ${issueKey || 'unknown'}: current status ${currentStatusName || 'unknown'} is not mapped`);
            return;
        }

        const changedToValues = [
            statusChange && statusChange.toString,
            resolutionChange && resolutionChange.toString
        ].filter(Boolean);

        if (changedToValues.includes(jiraNoiseResolution && jiraNoiseResolution.value) || changedToValues.includes(jiraNoiseStatus && jiraNoiseStatus.value)) {
            updatedStatus = {
                Name: 'Noise',
                Value: 'noise'
            };
        } else if (changedToValues.includes(jiraFixedResolution && jiraFixedResolution.value) || changedToValues.includes(jiraFixedStatus && jiraFixedStatus.value)) {
            updatedStatus = {
                Name: 'Fixed',
                Value: 'fixed'
            };
        } else if (changedToValues.includes(jiraInProgressStatus && jiraInProgressStatus.value)) {
            updatedStatus = {
                Name: 'In Progress',
                Value: 'inprogress'
            };
        } else if (changedToValues.includes(jiraReopenedStatus && jiraReopenedStatus.value)) {
            updatedStatus = {
                Name: 'Reopened',
                Value: 'reopened'
            };
        }

        if (!updatedStatus) {
            console.log(`Manual sync mode skipped for Jira issue ${issueKey || 'unknown'}: changed Jira values are not mapped`);
            return;
        }
    }

    console.log("Processing the issue update:", updatedStatus);

    const getAppId = await api.asApp().requestJira(route`/rest/api/3/issue/${event.issue.key}/properties/appscanappid`, {
        headers: {
            Accept: 'application/json'
        }
    });

    if (!getAppId.ok) {
        console.error(`AppScan application property not found for Jira issue ${event.issue.key}`);
        return;
    }

    const getAppIdJson = await getAppId.json();
    const applicationId = getAppIdJson && getAppIdJson.value ? getAppIdJson.value.appId : undefined;

    if (!applicationId) {
        console.error(`AppScan application ID is missing for Jira issue ${event.issue.key}`);
        return;
    }

    const credentials = await storage.getSecret(storageKeys.credentials);

    if (!credentials || Object.keys(credentials).length === 0) {
        console.error('Credentials not found. Please save credentials from login tab.');
        return;
    }

    const authResponse = await fetch(
        `${credentials.url}/api/v4/Account/ApiKeyLogin`,
        {
            method: "POST",
            headers: {
                accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                KeyId: credentials.keyId,
                KeySecret: credentials.keySecret,
            }),
        }
    );

    if (!authResponse.ok) {
        console.error('Invalid credentials configured');
        return;
    }

    const data = await authResponse.json();
    const authorizationHeader = `Bearer ${data.Token}`;

    // Update the issue comment and external ID in ASoC
    // Should we use ExternalID or AppScan Issue ID here ?
    const updateIssueURL = `${credentials.url}/api/v4/Issues/Application/${applicationId}?odataFilter=ExternalId%20eq%20'${event.issue.key}'`;
    const comment = `Status changed to ${updatedStatus.Name} in JIRA ticket ${event.issue.key}.`;

    console.log("updating in ASoC", updateIssueURL, comment, updatedStatus.Value);
    const updateIssueResponse = await fetch(
        updateIssueURL,
        {
            method: "PUT",
            headers: {
                accept: "application/json",
                "Content-Type": "application/json",
                Authorization: authorizationHeader,
            },
            body: JSON.stringify({
                Status: updatedStatus.Value,
                Comment: comment,
            }),
        }
    );

    console.log("update response from ASoC", updateIssueResponse.status);

    if (!updateIssueResponse.ok) {
        console.error(`Failed to update ASoC issue for Jira issue ${event.issue.key}`);
        return;
    }

    const updateIssueResponseJson = await updateIssueResponse.json();
    console.log("update done in ASoC", updateIssueResponseJson);



}
