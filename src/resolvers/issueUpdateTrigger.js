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
import { storageKeys } from '../appConstants';;
import api, { route, fetch, storage } from "@forge/api";
/**
 * This trigger is invoked when an issue is updated in Jira
 *
 */
export const issueUpdateTrigger = async function webtriggerhandler(event, context) {

    console.log("issueUpdateTrigger called");
    console.log(event);
    const formData = await storage.get(storageKeys.importConfiguration);
    if (!formData || Object.keys(formData).length == 0) {
        console.error('Import configuration is not set, please provide the configuration!');
        return;
    }
    const biDirectionalEnabled = formData.biDirectionalEnabled;
    const manualMappingEnabled = formData.manualMappingEnabled;
    const jiraFixedStatus = formData.jiraFixedStatus;
    const jiraFixedResolution = formData.jiraFixedResolution;
    const jiraNoiseStatus = formData.jiraNoiseStatus;
    const jiraNoiseResolution = formData.jiraNoiseResolution;
    const jiraInProgressStatus = formData.jiraInProgressStatus;
    const jiraReopenedStatus = formData.jiraReopenedStatus;
    const manualStatuses = [jiraFixedStatus.value, jiraNoiseStatus.value, jiraInProgressStatus.value, jiraReopenedStatus.value];

    console.log("biDirectionalEnabled : ", biDirectionalEnabled);
    console.log("Manual jira status mapping enabled : ", manualMappingEnabled)
    console.log("event.issue.fields.status.name: ", event.issue.fields.status.name)
    console.log("manualStatuses: ", manualStatuses)

    if (biDirectionalEnabled && ((!manualMappingEnabled && event.issue.fields.status.name === 'Done') ||
                                manualMappingEnabled && manualStatuses.includes(event.issue.fields.status.name))
                            )
    {
        console.log("jiraNoiseResolution: ", jiraNoiseResolution.value)
        console.log("jiraNoiseStatus: ", jiraNoiseStatus.value)

        let changeTo = event.changelog.items[0]["toString"]
        let updatedStatus = {}
        console.log("changedTo", changeTo)
        console.log(event.changelog)
// Need better logic here, this is just to get the updates working
// If it is a resolution that is triggering the update, and it is the item that is being tracked
// that is what needs to change. But if it is null, and it is only status, then that needs to be changed.

        //ASoC permissible statuses are open, inprogress, noise, fixed, reopened or passed
        switch (changeTo) {
            case jiraNoiseResolution.value:
            case jiraNoiseStatus.value:
                updatedStatus = {
                    Name: 'Noise',
                    Value: 'noise'
                }
                break;
            case jiraFixedResolution.value:
            case jiraFixedStatus.value:
                updatedStatus = {
                    Name: 'Fixed',
                    Value: 'fixed'
                }
                break;
            case jiraInProgressStatus.value:
                updatedStatus = {
                    Name: 'In Progress',
                    Value: 'inprogress'
                }
                break;
            case jiraReopenedStatus.value:
                updatedStatus = {
                    Name: 'Reopened',
                    Value: 'reopened'
                }
                break;

            default:
                updatedStatus = 'Unknown'
                console.log('Update status set to manual and not mapped in function issueUpdateTrigger')
        }

        console.log("Processing the issue update : ", biDirectionalEnabled);

        const getAppId = await api.asApp().requestJira(route`/rest/api/3/issue/${event.issue.key}/properties/appscanappid`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        const getAppIdJson = await getAppId.json();

        let applicationId = getAppIdJson.value.appId;
        const credentials = await storage.getSecret(storageKeys.credentials);

        if (!credentials || Object.keys(credentials).length == 0) {
            console.error('Credentials not found. Please save credentials from login tab.');
            return;
        }

        const authResponse = await fetch(
            credentials.url + "/api/v4/Account/ApiKeyLogin",
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

        let updateIssueURL = `${credentials.url}/api/v4/Issues/Application/${applicationId}?odataFilter=ExternalId%20eq%20'${event.issue.key}'`;
        let status = updatedStatus;
        let comment = `Status changed to ${updatedStatus.Name} in JIRA ticket ${event.issue.key}.` ;
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
                    Status: status.Value,
                    Comment: comment,
                }),
            }
        );

        console.log("updade response from ASoC", updateIssueResponse);

        const updateIssueResponseJson = await updateIssueResponse.json();
        console.log("update done in ASoC", updateIssueResponseJson);

    } else {
        console.log("No match found");
    }


}
