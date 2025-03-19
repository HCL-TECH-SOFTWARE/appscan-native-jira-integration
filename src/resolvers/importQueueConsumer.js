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
import Resolver from '@forge/resolver';
import api, { route, fetch, storage } from "@forge/api";
import { v4 as uuidv4 } from 'uuid';
import { getAppScanEnv, formatDateString, getAnalyzerType } from '../frontend/utils';
import { storageKeys } from '../appConstants';

const resolver = new Resolver();

/**
 * This consumer listens to the importQueue. This will import issues into Jira.
 * 1. It will first call ASoC to get issue details.
 * 2. It will then call Jira api to create a issue
 * 3. It will the call ASoC again to get file details
 * 4. This file is then uploaded to jira against the newly created issue
 * 5. At the end a record will be inserted into importDetails entity for tracking.
 */
resolver.define("import-queue-consumer", async ({ payload, context }) => {
    // process the event
    const startTime = new Date().getTime();
    console.log('import queue called', context);

    const item = payload.item;
    const formData = payload.formData;
    const authorizationHeader = payload.authorizationHeader;
    const importId = payload.importId;
    const importDateTime = payload.importDateTime;
    const importType = payload.importType;
    const appScanUrl = payload.appScanUrl;
    const jiraBaseUrl = payload.jiraBaseUrl;
    const appId = payload.appId;
    const issueId = payload.issueId;
    const batchId = payload.batchId;
    const appscanEnv = getAppScanEnv(appScanUrl);
    
    const logMetadata = {
        importId: importId,
        appId: appId,
        issueId: issueId,
        batchId: batchId
    }
    console.log('import queue payload data', { formData, importDateTime, importType, appScanUrl, appscanEnv }, logMetadata);

    try {
        const severityMap = new Map(Object.entries(formData));
        // It fetches the Jira Priority ID's for each Jira Priority. Instead of calling this api each time , we can cache it for further use. Move it to appQueueConsumer / storage ?
        const priorityResponse = await api.asApp().requestJira(route`/rest/api/2/priority`, {
            headers: {
              'Accept': 'application/json'
            }
          });

          const priorityResponseJson = await priorityResponse.json();

          const jiraPriorityIDMap = {};

          priorityResponseJson.forEach(priority => {
            jiraPriorityIDMap[priority.name] = priority.id;
          }); 
        console.log("jiraPriorityIDMap : " , jiraPriorityIDMap);

        // Creating a Map from the jiraPriorityIDMap
        const priorityMap = new Map(Object.entries(jiraPriorityIDMap));
        const itemSeverity = item.Severity;
        let itemSeverityStr = "jiraSeverity" + itemSeverity;

        const jiraPriority = severityMap.get(itemSeverityStr);
        const jiraPriorityID = priorityMap.get(jiraPriority.value);
        const formattedDateCreated = formatDateString(item.DateCreated);
        const formattedLastUpdated = formatDateString(item.LastUpdated);
        const formattedLastFound = formatDateString(item.LastFound);
        const scannerType = getAnalyzerType(item.Scanner);
        const recommendationLink = appScanUrl + "/api/v4/Reports/Article/?issuetype=" + item.IssueTypeId + "&nl=en";
 
        let description = ``;
        description += "\n{quote}";
        description += `\n*AppScan Issue ID*: ${item.Id}`;
        description += `\n*Issue Type*: ${item.IssueType}`;
        description += `\n*Severity*: ${item.Severity}`;
        description += `\n*Location*: ${item.Location}`;
        description += `\n*Scan Name*: ${item.ScanName}`;
        description += `\n*CWE*: ${item.Cwe}`;
        description += `\n*CVSS*: ${item.Cvss}`;
        description += `\n*Date Created*: ${formattedDateCreated}`;
        description += `\n*Last Updated*: ${formattedLastUpdated}`;
        description += `\n*Last Found*: ${formattedLastFound}`;
        description += `\n*AppScan Environment*: ${appscanEnv}`;
        description += `\n*Recommendation*: ${recommendationLink}`;
        description += "\n{quote}";
        description += "\nSee the attached report for more information";
        //Map fields from ASoC Issue to Jira issue object

        const issueData = {
            fields: {
                project: {
                    id: formData.selectedProject.value,
                },
                summary: `Security issue: ${item.IssueType} found by ${scannerType}`,
                description: description,
                issuetype: {
                    id: formData.selectedIssueType.value,
                },
                labels: ["AppScan"],
                priority: {
                    id: jiraPriorityID,
                },
                
            },
        };


        const issueDataJson = JSON.stringify(issueData);

        const jiraIssueCreationResponse = await api.asApp().requestJira(route`/rest/api/2/issue`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: issueDataJson
        });

        console.log('issue creation response', jiraIssueCreationResponse, logMetadata);
        const jiraIssueCreationResponseJson = await jiraIssueCreationResponse.json();

        if (jiraIssueCreationResponseJson && jiraIssueCreationResponseJson.hasOwnProperty('errorMessages')) {
            console.error('Error occured while creating issue', jiraIssueCreationResponseJson, logMetadata);
            throw new Error(`${jiraIssueCreationResponseJson}`);
        }

        console.log("Issue created successfully!", logMetadata);
        var appIdData = {
            appId : appId
        };
        var appIdDataJson = JSON.stringify(appIdData);

        const response = await api.asApp().requestJira(route`/rest/api/3/issue/${jiraIssueCreationResponseJson.key}/properties/appscanappid`, {
            method: 'PUT',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: appIdDataJson
          });

          console.log(`Updated appscanappid property in Jira - Response: ${response.status} ${response.statusText}`);
          

        // Update the issue comment and external ID in ASoC
        let updateIssueURL = `${appScanUrl}/api/v4/Issues/Application/${item.ApplicationId}?odataFilter=Id%20eq%20${item.Id}`;
        let externalId = jiraIssueCreationResponseJson.key;
        let comment = 'HCL AppScan Integration Jira Plugin created the following issue: ' + jiraBaseUrl + '/browse/' + jiraIssueCreationResponseJson.key;
        console.log("updating in ASoC", updateIssueURL, externalId, comment, logMetadata);
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
                    ExternalId: externalId,
                    Comment: comment,
                }),
            }
        );

        console.log("updade response from ASoC", updateIssueResponse, logMetadata);

        const updateIssueResponseJson = await updateIssueResponse.json();
        console.log("update done in ASoC", updateIssueResponseJson, logMetadata);

        let fetchIssuesArtifactURL = `${appScanUrl}/api/v4/Issues/${item.Id}/Details?locale=en-US`;
        const artifactsRequest = await fetch(
            fetchIssuesArtifactURL,
            {
                method: "GET",
                headers: {
                    accept: "text/html",
                    Authorization: authorizationHeader,
                },
            }
        );

        console.log("file response from ASoC", artifactsRequest, logMetadata);

        const artifactsResponse = await artifactsRequest.text();

        const filename = item.Id + "_details.html";

        // Convert the HTML string to a buffer
        const buffer = Buffer.from(artifactsResponse, 'utf-8');

        // Create a form boundary
        const boundary = `----WebKitFormBoundary${Math.random().toString(16)}`;
        // Construct the multipart form data payload
        let payloadString = `--${boundary}\r\n`;
        payloadString += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
        payloadString += `Content-Type: text/html\r\n\r\n`;
        payloadString += `${buffer.toString()}\r\n`;
        payloadString += `--${boundary}--`;

        // Make the request to Jira's attachment API endpoint

        console.log("before uploading file - ", logMetadata);
        const attachmentresponse = await api.asApp().requestJira(route`/rest/api/2/issue/${jiraIssueCreationResponseJson.id}/attachments`, {
            method: "POST",
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'X-Atlassian-Token': 'no-check',
            },
            body: payloadString
        });
        console.log("attachment response in Jira", attachmentresponse, logMetadata);

        if (attachmentresponse && attachmentresponse.hasOwnProperty('errorMessages')) {
            console.error('Error occured while uploading file to Jira', attachmentresponse, logMetadata);
            throw new Error(`${attachmentresponse.errorMessages}`);
        }

        const attachmentresponseJson = await attachmentresponse.json();
        console.log("attachment done in Jira", logMetadata);

        await storage.entity(storageKeys.importDetails).set(`import-${uuidv4()}`,
            {
                importId: importId, applicationId: item.ApplicationId, issueId: item.Id, dateTime: importDateTime, status: true, importType: importType, batchId: batchId
            });

        console.log('import done', logMetadata)
    }
    catch (e) {
        console.error('failed Import', e, logMetadata)
        await storage.entity(storageKeys.importDetails).set(`import-${uuidv4()}`,
            {
                importId: importId, applicationId: item.ApplicationId, issueId: item.Id, dateTime: importDateTime, importType: importType, status: false, details: e.message, batchId: batchId
            });
    }

    console.log('import queue completed', logMetadata)
    const endTime = new Date().getTime();
    console.log(`time taken ${(endTime - startTime) / 1000} seconds`, logMetadata);
});

export const importQueueHandler = resolver.getDefinitions();