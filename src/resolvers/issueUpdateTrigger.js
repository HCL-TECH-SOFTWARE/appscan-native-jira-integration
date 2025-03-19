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
    console.log("biDirectionalEnabled : " , biDirectionalEnabled);

    if ( biDirectionalEnabled && event.issue.fields.status.name==='Done') {
        console.log("Processing the issue update : " , biDirectionalEnabled);

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
let status = 'Fixed';
let comment = 'Fixed on JIRA';
console.log("updating in ASoC", updateIssueURL, comment , status);
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
            Status: status,
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
