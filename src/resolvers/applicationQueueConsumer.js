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
import { importQueue, appQueue } from './queues';
import { maxEventPerRequestInQueue, importIssuesDealyInSeconds, maxAllowedQueueDelayInSeconds } from '../appConstants';

const resolver = new Resolver();

/**
 * This queue consumer will listen events pushed on appQueue. 
 * This will call ASoC to get list of issues for the specific application 
 * and then push these issues to importQueue for importing issues
 */
resolver.define("app-queue-consumer", async ({ payload, context }) => {

    console.log('app queue called', context);
    const appId = payload.appId;
    const policyIds = payload.policyIds;
    const maxIssues = payload.maxIssues;
    const stateFilter = payload.stateFilter;
    const severityFilter = payload.severityFilter;
    const authorizationHeader = payload.authorizationHeader;
    const formData = payload.formData;
    const importDateTime = payload.importDateTime;
    const importId = payload.importId;
    const importType = payload.importType;
    const appScanUrl = payload.appScanUrl;
    const jiraBaseUrl = payload.jiraBaseUrl;
    const scanTypeFilter = payload.scanTypeFilter;
    const batchId = payload.batchId;
    const logMetadata = {
        importId: importId,
        appId: appId,
        batchId: batchId
    }
    console.log('app queue payload data', { policyIds, maxIssues, stateFilter, severityFilter, formData, importDateTime, importType, appScanUrl, jiraBaseUrl, scanTypeFilter }, logMetadata);

    if (payload.delay > maxAllowedQueueDelayInSeconds) {
        console.log('app queue delayed', payload.delay, payload, context, logMetadata);
        payload.delay = payload.delay - maxAllowedQueueDelayInSeconds;
        await appQueue.push(payload, { delayInSeconds: maxAllowedQueueDelayInSeconds });
        return;
    }
    else if (payload.delay > 0) {
        console.log('app queue delayed', payload.delay, payload, context, logMetadata);
        const delay = payload.delay;
        payload.delay = payload.delay - maxAllowedQueueDelayInSeconds;
        await appQueue.push(payload, { delayInSeconds: delay });
        return;
    }

    console.log('app queue is running', payload.delay, payload, logMetadata);

    let fetchIssuesURL = `${appScanUrl}/api/v4/Issues/Application/${appId}`;
    if (policyIds) {
        fetchIssuesURL +=
            `?applyPolicies=Select&selectPolicyIds=` +
            policyIds.join("&selectPolicyIds=");
    }
    else {
        // Apply all policies
        fetchIssuesURL += `?applyPolicies=All`;
    }

    fetchIssuesURL += `&%24top=${maxIssues}&%24filter=%28${stateFilter}%29 and %28${severityFilter}%29 and %28${scanTypeFilter}%29 and ExternalId eq null&%24count=true`;
    console.log("fetchIssuesURL = ", fetchIssuesURL, logMetadata);

    const issuesResponseJson = await fetch(
        fetchIssuesURL,
        {
            method: "GET",
            headers: {
                accept: "application/json",
                Authorization: authorizationHeader,
            },
        }
    );
    console.log("issue response from ASoC", 'appId:', appId, issuesResponseJson, logMetadata)

    const issueResponseFromASoC = await issuesResponseJson.json();
    console.log("issueResponseFromASoC", 'appId:', appId, issueResponseFromASoC.Count, logMetadata)
    if (issueResponseFromASoC.hasOwnProperty("Message")) {
        console.log(
            "Encountered an error while fetching the issues from AppScan on Cloud. Please check the input values and try again ! ",
            issueResponseFromASoC.Message, logMetadata
        );
    }
    else {
        let issueRequests = [];
        for (const item of issueResponseFromASoC.Items) {
            const payload =
            {
                item: item,
                formData: formData,
                authorizationHeader: authorizationHeader,
                importId: importId,
                importDateTime: importDateTime,
                importType: importType,
                appScanUrl: appScanUrl,
                jiraBaseUrl: jiraBaseUrl,
                appId: appId,
                issueId: item.Id,
                batchId: batchId,
            };
            issueRequests.push(payload);
        }

        if (issueRequests.length) {
            console.log(`found ${issueRequests.length} issues`, logMetadata);
            const chunkSize = maxEventPerRequestInQueue;
            let delayCount = 0;
            for (let i = 0; i < issueRequests.length; i += chunkSize) {
                let chunk = issueRequests.slice(i, i + chunkSize);
                console.log(`Pushing to import queue delayCount:${delayCount} importCount:${chunk.length}`, logMetadata);
                await importQueue.push(chunk, { delayInSeconds: delayCount });
                delayCount = delayCount + importIssuesDealyInSeconds;
            }
        }

    }

});

export const appQueueHandler = resolver.getDefinitions();