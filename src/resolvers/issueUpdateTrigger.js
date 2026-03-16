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
    
    if (formData.biDirectionalEnabled){

        const manualMappingEnabled = formData.manualMappingEnabled;
        const jiraFixedStatus = formData.jiraFixedStatus;
        const jiraFixedResolution = formData.jiraFixedResolution;
        const jiraNoiseStatus = formData.jiraNoiseStatus;
        const jiraNoiseResolution = formData.jiraNoiseResolution;
        const jiraInProgressStatus = formData.jiraInProgressStatus;
        const jiraReopenedStatus = formData.jiraReopenedStatus;

        const manualStatuses = [jiraFixedStatus?.value, jiraNoiseStatus?.value, jiraInProgressStatus?.value, jiraReopenedStatus?.value];
        if((!manualMappingEnabled && event.issue.fields.status.name === 'Done') || 
            manualMappingEnabled && manualStatuses.includes(event.issue.fields.status.name))
        {
            let updatedStatus = {}
            let changeTo = event.changelog.items.find(x => x.field==='resolution')
            // If there is a resolution section present
            if (typeof changeTo !== 'undefined' ) {
                // AND there is a toString, AND we care that there even IS a toString
                if (Object.hasOwn(changeTo, 'toString') && 
                    (jiraFixedResolution?.value || jiraFixedResolution?.value))
                    {
                    // Then we set the changeTo that value so it can be handled later on.
                    changeTo = changeTo["toString"]
                    } else {
                        // This kludge just makes some future logic easier.
                        changeTo = undefined
                    }
            }
            
            // If the logic is easy, no manual mapping, handle that first.
            if (!manualMappingEnabled) {
                updatedStatus = {
                Name: 'Fixed',
                Value: 'Fixed'
                }
                changeTo = "Done"
            } else if(typeof changeTo === 'undefined') {
                // This means that reslolution item was not present or we are changing AWAY from a "resolved" state.
                changeTo = event.issue.fields.status.name
                switch (changeTo) {
                    case jiraFixedStatus.value:
                        // Since we made it here, and there is no resloution present, if there is no configuration
                        // in the database that means that there was none required at time of configuration of the
                        // plugin. Therefore, we can go ahead and set the issue to fixed.
                        if(!jiraFixedResolution.value || typeof jiraFixedResolution.value === 'undefined') {
                            updatedStatus = {
                                Name: 'Fixed',
                                Value: 'Fixed'
                            }
                            break;
                        }
                    case jiraNoiseStatus.value:
                        // Same logic as above but with Noise status. Note there should NOT be matching noise and fixed
                        // statuses without separate resolutions present.
                        if(!jiraNoiseResolution.value || typeof jiraNoiseResolution.value === 'undefined') {
                            updatedStatus = {
                                Name: 'Noise',
                                Value: 'Noise'
                            }
                            break;
                        }
                    case jiraInProgressStatus.value:
                        updatedStatus = {
                            Name: 'In Progress',
                            Value: 'InProgress'
                        }
                        break;
                    case jiraReopenedStatus.value:
                        updatedStatus = {
                            Name: 'Reopened',
                            Value: 'Reopened'
                        }
                        break;

                    default:
                        updatedStatus = 'Unknown'
                        console.log('Update status set to manual and not mapped in function issueUpdateTrigger')
                        return;
                }

            // This means item has been moved into a resolved status and we also have a value set in the configuration.
            } else if (jiraNoiseResolution.value == changeTo) {
                updatedStatus = {
                Name: 'Noise',
                Value: 'Noise'
                }
            } else if (jiraFixedResolution.value == changeTo) {
                updatedStatus = {
                Name: 'Fixed',
                Value: 'Fixed'
                }
            } else {
                console.log('Unable to determine status the issue changed to.')
                return;
            }

            console.log("Processing the issue update : ", updatedStatus);

            // TODO: This should all be in a try/catch.
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

        } 
    }
    //else {
    //    console.log("No match found");
    //} Commenting as this seems to be a debugging message, no need to fill up the logs 


}
