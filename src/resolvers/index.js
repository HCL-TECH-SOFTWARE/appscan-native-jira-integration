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
import { SortOrder, fetch, storage, WhereConditions, FilterConditions } from "@forge/api";
import { appQueue, historyQueue } from './queues';
import { importHistoryDelayInSeconds, maxEventPerRequestInQueue, appQueueDealyInSeconds, storageKeys, importIssuesDealyInSeconds, importType, importBatchSize, maxAllowedQueueDelayInSeconds } from '../appConstants';

const resolver = new Resolver();
const clientType = "native-jira-1.1.0";

resolver.define('login', async (req) => {

  const authResponse = await fetch(
    req.payload.url + "/api/v4/Account/ApiKeyLogin",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "ClientType":clientType
      },
      body: JSON.stringify({
        KeyId: req.payload.keyId,
        KeySecret: req.payload.keySecret,
        ClientType:clientType
      }),
    }
  );
  let res = {};
  if (authResponse.ok) {
    res = await authResponse.json();
  }
  else {
    res = { Message: 'Authentication failed' }
  }
  return res;

});

resolver.define('getTenantInfo', async (req) => {
  console.log('request', req);
  const tenantInfo = await fetch(
    req.payload.url + "/api/v4/Account/TenantInfo",
    {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: req.payload.authorizationHeader,
      },
    }
  );

  let res = { header: { ok: tenantInfo.ok } };

  if (tenantInfo.ok) {
    res.data = await tenantInfo.json();
  }
  return res;

});

resolver.define('getImportHistory', async (req) => {
  let importsummary = [];
  let cursor = req.payload.nextCursor;

  do {
    const importHistory = await storage
      .entity(storageKeys.importHistory)
      .query()
      .index('dateTime')
      .sort(SortOrder.DESC)
      .limit(10)
      .cursor(cursor)
      .getMany();

    importsummary = [...importsummary, ...importHistory.results];
    cursor = importHistory.nextCursor;
    if (importsummary.length >= 10) {
      break;
    }
  }
  while (cursor);

  importsummary = importsummary.map(item => item.value);

  return { data: importsummary, cursor: cursor };

});

resolver.define('storage', async (req) => {

  if (req.payload.type == 'GET') {
    const data = await storage.get(req.payload.storageKey);
    return data;
  }
  if (req.payload.type == 'POST') {
    await storage.set(req.payload.storageKey, req.payload.formData);
  }

});

resolver.define('secretStorage', async (req) => {

  if (req.payload.type == 'GET') {
    const data = await storage.getSecret(req.payload.storageKey);
    return data;
  }
  if (req.payload.type == 'POST') {
    await storage.setSecret(req.payload.storageKey, req.payload.formData);
  }

});

resolver.define('fetchAllApps', async (req) => {

  const fetchAllAppsResponse = await fetch(
    req.payload.fetchAllAppsURL + "/api/v4/Apps?%24top=5000&%24select=Id%2CName&%24count=false",
    {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: req.payload.authorizationHeader,
      },
    }
  );
  const fetchAllAppsResponseJson = await fetchAllAppsResponse.json();
  return fetchAllAppsResponseJson;
});

resolver.define('getIssueCountByImportId', async (req) => {
  let importDetails = [];
  let cursor = null;
  let batchId = req.payload.batchId;
  let lastCount = req.payload.lastCount;
  const importId = req.payload.importId;
  let currentCount = 0;
  //get records from current batch
  do {
    const results = await storage
      .entity(storageKeys.importDetails)
      .query()
      .index("by-importId-per-batchid", {
        partition: [importId]
      })
      .where(WhereConditions.equalsTo(batchId))
      .limit(20)
      .cursor(cursor)
      .getMany()
    importDetails = [...importDetails, ...results.results]
    cursor = results.nextCursor;
  }
  while (cursor);

  //check if next batch started
  const isNextBatchExists = await storage
    .entity(storageKeys.importDetails)
    .query()
    .index("by-importId-per-batchid", {
      partition: [importId]
    })
    .where(WhereConditions.equalsTo(batchId + 1))
    .getOne();


  currentCount = importDetails.length;
  // console.log(`currentCount ${currentCount} lastCount ${lastCount} batchId ${batchId}`);
  const res = { count: lastCount + currentCount, lastCount: lastCount, batchId: batchId }

  if (isNextBatchExists) {
    res.batchId = batchId + 1;
    res.lastCount = lastCount + currentCount;
  }
  return res;

});

resolver.define('pushIssuesForImport', async (req) => {
  const appQueueRequest = req.payload.requestdata;
  if (appQueueRequest.length) {
    const maxIssues = appQueueRequest[0].maxIssues;
    const importId = appQueueRequest[0].importId;

    let delayCount = 0;
    let batchId = 1;
    for (let i = 0; i < appQueueRequest.length; i++) {
      let chunk = appQueueRequest[i];
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
        console.log(`pushing to appQueue from one time import maxIssues:${maxIssues}, maxIssueSupport:${maxIssueSupport}, delay:${delayCount}, batchid:${batchId}`)
        chunk.delay = delayCount - maxAllowedQueueDelayInSeconds;
        chunk.batchId = batchId;
        chunk.jiraBaseUrl = req.context.siteUrl;
        await appQueue.push(chunk, { delayInSeconds: delayCount > maxAllowedQueueDelayInSeconds ? maxAllowedQueueDelayInSeconds : delayCount });
        delayCount = delayCount + appQueueDealyInSeconds + (Math.ceil(chunk.maxIssues / maxEventPerRequestInQueue) * importIssuesDealyInSeconds);
        batchId++;
      }
    }

    console.log('delay count after pushing all apps', delayCount);

    let importTime = Date.now();
    console.log('importTime', importTime);
    importTime += (delayCount + 30) * 1000;
    await storage.set(storageKeys.importStatus, { isInProgress: true, importId: importId, isHistoryCalled: false, importTime: importTime });

    const historyDelayCount = delayCount;
    console.log(`History will be called after ${(historyDelayCount) / 60} minutes = ${historyDelayCount} secs`);
    await historyQueue.push({ importId: importId, deleteOnly: false, importType: importType.manual, updateHistoryCalledFlag: true, delay: historyDelayCount - maxAllowedQueueDelayInSeconds }, { delayInSeconds: historyDelayCount > maxAllowedQueueDelayInSeconds ? maxAllowedQueueDelayInSeconds : historyDelayCount });
  }

});

resolver.define('fetchAllPolicies', async (req) => {

  const fetchAllPoliciesResponse = await fetch(
    req.payload.fetchAllPoliciesURL + "/api/v4/Policies?%24top=100&%24select=Id%2CName&%24count=false",
    {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: req.payload.authorizationHeader,
      },
    }
  );
  const fetchAllPoliciesResponseJson = await fetchAllPoliciesResponse.json();
  return fetchAllPoliciesResponseJson;
});


export const handler = resolver.getDefinitions();