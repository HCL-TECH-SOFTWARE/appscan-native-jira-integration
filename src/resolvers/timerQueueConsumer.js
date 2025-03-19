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
import { appQueue, historyQueue, timerQueue } from './queues';
import { v4 as uuidv4 } from 'uuid';
import { storageKeys, importIssuesDealyInSeconds, appQueueDealyInSeconds, importType, importBatchSize, maxEventPerRequestInQueue, maxAllowedQueueDelayInSeconds } from '../appConstants';

const resolver = new Resolver();

/**
 * This conusmer listens to timerQueue.
 * This will keep on delaying the job until the specified time is reached.
 * e.g. 4pm, 6pm etc
 */

resolver.define("timer-queue-consumer", async ({ payload, context }) => {

    console.log('timer queue called', payload, context);
    if (payload.diffTime > 60 * 60) {
        console.log('timer is more than an hour, so closing the timer now')
    }
    else if (payload.diffTime >= maxAllowedQueueDelayInSeconds) {
        await timerQueue.push({ diffTime: payload.diffTime - maxAllowedQueueDelayInSeconds, maxIssues: payload.maxIssues }, { delayInSeconds: maxAllowedQueueDelayInSeconds });
    }
    else if (payload.diffTime > 30 && payload.diffTime < maxAllowedQueueDelayInSeconds) {
        await timerQueue.push({ diffTime: 0, maxIssues: payload.maxIssues }, { delayInSeconds: payload.diffTime });
    }
    else if (payload.diffTime <= 30) {
        console.log('job running now...')
        await importIssues(payload.maxIssues);
    }
});


const fetchJiraBaseUrl = async () => {
    try {

        const response = await api.asApp().requestJira(route`/rest/api/3/serverInfo`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        const serverInfoData = await response.json();
        return serverInfoData.baseUrl;
    } catch (error) {
        console.error("Error fetching baseUrl:", error);
    }
};

const importIssues = async (maxIssues) => {
    const formData = await storage.get(storageKeys.importConfiguration);
    if (!formData || Object.keys(formData).length == 0) {
        console.error('Import configuration is not set, please provide the configuration!');
        return;
    }

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

    let arrayOfAppIds = [];

    let arrayOfValues = formData.applicationId.map(obj => obj.value);

    if (arrayOfValues.length == 0) {
        console.error('No applications found, please check configuration!');
        return;
    }

    if (arrayOfValues.includes('all') || formData.applicationId.length == 0) {
        let fetchAllAppsURL = credentials.url;
        const fetchAllAppsResponse = await fetch(
            fetchAllAppsURL + "/api/v4/Apps?%24top=5000&%24select=Id%2CName&%24count=false",
            {
                method: "GET",
                headers: {
                    accept: "application/json",
                    Authorization: authorizationHeader,
                },
            }
        );
        const fetchAllAppsResponseJson = await fetchAllAppsResponse.json();

        for (const app of fetchAllAppsResponseJson.Items) {
            arrayOfAppIds.push(app.Id);
        }
    } else {

        arrayOfAppIds = arrayOfValues;
    }

    const states = formData.issuesStates;
    const stateFilterBuilder = [];
    // state filter
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

    let currentDateTime = Date.now().toString();

    const importId = uuidv4();
    const finalAppPayload = [];
    const jiraBaseUrl = await fetchJiraBaseUrl();
    for (const appId of arrayOfAppIds) {
        const payload = {
            appId: appId,
            policyIds: policyIds,
            maxIssues: maxIssues,
            stateFilter: stateFilter,
            severityFilter: severityFilter,
            scanTypeFilter: scanTypeFilter,
            authorizationHeader: authorizationHeader,
            formData: formData,
            importId: importId,
            importDateTime: currentDateTime,
            importType: 'Auto',
            appScanUrl: credentials.url,
            jiraBaseUrl: jiraBaseUrl
        };
        finalAppPayload.push(payload);
    }

    if (finalAppPayload.length) {
        console.log(`found ${finalAppPayload.length} apps`, { importId: importId })

        let delayCount = 0;
        let batchId = 1;
        for (let i = 0; i < finalAppPayload.length; i++) {
            let chunk = finalAppPayload[i];
            let maxIssueSupport = maxIssues;
            while (maxIssueSupport > 0) {
                if (maxIssueSupport < importBatchSize) {
                    chunk.maxIssues = maxIssueSupport;
                    maxIssueSupport = 0;
                }
                else {
                    chunk.maxIssues = importBatchSize;
                    maxIssueSupport = maxIssueSupport - importBatchSize;
                }
                console.log(`pushing to appQueue from auto import maxIssues:${maxIssues}, maxIssueSupport:${maxIssueSupport}, delay:${delayCount}`)
                chunk.delay = delayCount - maxAllowedQueueDelayInSeconds;
                chunk.batchId = batchId;
                await appQueue.push(chunk, { delayInSeconds: delayCount > maxAllowedQueueDelayInSeconds ? maxAllowedQueueDelayInSeconds : delayCount });
                delayCount = delayCount + appQueueDealyInSeconds + (Math.ceil(importBatchSize / maxEventPerRequestInQueue) * importIssuesDealyInSeconds);
                batchId++;
            }

        }

        const historyDelayCount = delayCount;
        console.log(`History will be called after ${(historyDelayCount) / 60} minutes = ${historyDelayCount} secs`);
        await historyQueue.push({ importId: importId, deleteOnly: false, importType: importType.auto, delay: historyDelayCount - maxAllowedQueueDelayInSeconds }, { delayInSeconds: historyDelayCount > maxAllowedQueueDelayInSeconds ? maxAllowedQueueDelayInSeconds : historyDelayCount });
    }
}

export const timerQueueHandler = resolver.getDefinitions();