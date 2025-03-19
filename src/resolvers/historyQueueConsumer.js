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
import { WhereConditions, storage } from "@forge/api";
import { v4 as uuidv4 } from 'uuid';
import { importType, storageKeys, maxAllowedQueueDelayInSeconds } from '../appConstants';
import { historyQueue } from './queues';

const resolver = new Resolver();

/**
 * This consumer will listen to historyQueue. 
 * This will update the records in the importSummary entity and delete records from importDetails entity.
 */

resolver.define("history-queue-consumer", async ({ payload, context }) => {

    console.log('history queue called', payload, context, { importId: payload.importId });
    const startTime = new Date().getTime();

    if (payload.delay > maxAllowedQueueDelayInSeconds) {
        console.log('history queue delayed', payload, context, { importId: payload.importId });
        await historyQueue.push({ importId: payload.importId, deleteOnly: false, importType: payload.importType, updateHistoryCalledFlag: payload.updateHistoryCalledFlag, delay: payload.delay - maxAllowedQueueDelayInSeconds }, { delayInSeconds: maxAllowedQueueDelayInSeconds });
        return;
    }
    else if (payload.delay > 0) {
        console.log('history queue delayed', payload, context, { importId: payload.importId });
        await historyQueue.push({ importId: payload.importId, deleteOnly: false, importType: payload.importType, updateHistoryCalledFlag: payload.updateHistoryCalledFlag, delay: payload.delay - maxAllowedQueueDelayInSeconds }, { delayInSeconds: payload.delay });
        return;
    }

    //if called first time then setting the flag
    if (payload.updateHistoryCalledFlag) {
        const importStatus = await storage.get(storageKeys.importStatus);
        importStatus.isHistoryCalled = true;
        await storage.set(storageKeys.importStatus, importStatus);
        payload.updateHistoryCalledFlag = false;
        await historyQueue.push(payload, { delayInSeconds: 5 });
        return;
    }

    let array = [];
    let cursor = payload.cursor;
    do {
        const results = await storage
            .entity(storageKeys.importDetails)
            .query()
            .index('importId')
            .where(WhereConditions.equalsTo(payload.importId))
            .limit(20)
            .cursor(cursor)
            .getMany()
        array = [...array, ...results.results]
        cursor = results.nextCursor;

        if (payload.deleteOnly) {
            if (array.length >= 250) {
                break;
            }
        }
        else {
            const endTime = new Date().getTime();
            if ((endTime - startTime) / 1000 > 40) {

                const newArray = array.map(item => item.value);
                const res = Object.values(newArray.reduce((acc, { importId, dateTime, importType, status }) => {
                    acc[importId] = acc[importId] || { importId: importId, dateTime: dateTime, importType: importType, issueCount: 0, successCount: 0, failureCount: 0, status: status };
                    acc[importId]['issueCount'] += 1;
                    acc[importId]['successCount'] += status ? 1 : 0;
                    acc[importId]['failureCount'] += status ? 0 : 1;
                    return acc;
                }, {}))[0];

                payload.issueCount = payload.issueCount ? payload.issueCount : 0;
                payload.issueCount += res.issueCount;

                payload.successCount = payload.successCount ? payload.successCount : 0;
                payload.successCount += res.successCount;

                payload.failureCount = payload.failureCount ? payload.failureCount : 0;
                payload.failureCount += res.failureCount;

                payload.cursor = cursor;

                await historyQueue.push(payload, { delayInSeconds: 1 });
                console.log('history queue requeued for further processing');
                return;
            }
        }
    }
    while (cursor)

    if (array && array.length) {
        if (payload.deleteOnly) {
            console.log(`deleting ${array.length} records from history`);
            const importKeys = array.map(item => item.key);
            for (const key of importKeys) {
                await storage.entity(storageKeys.importDetails).delete(key);
            }
        }
        else {
            const newArray = array.map(item => item.value);
            const res = Object.values(newArray.reduce((acc, { importId, dateTime, importType, status }) => {
                acc[importId] = acc[importId] || { importId: importId, dateTime: dateTime, importType: importType, issueCount: 0, successCount: 0, failureCount: 0, status: status };
                acc[importId]['issueCount'] += 1;
                acc[importId]['successCount'] += status ? 1 : 0;
                acc[importId]['failureCount'] += status ? 0 : 1;
                return acc;
            }, {}))[0];

            payload.issueCount = payload.issueCount ? payload.issueCount : 0;
            res.issueCount += payload.issueCount;

            payload.successCount = payload.successCount ? payload.successCount : 0;
            res.successCount += payload.successCount;

            payload.failureCount = payload.failureCount ? payload.failureCount : 0;
            res.failureCount += payload.failureCount;

            await storage.entity(storageKeys.importHistory).set(`import-${uuidv4()}`,
                {
                    importId: res.importId, dateTime: res.dateTime, status: res.status, issueCount: res.issueCount, successCount: res.successCount, failureCount: res.failureCount, importType: res.importType
                });
        }
        await historyQueue.push({ importId: payload.importId, importType: payload.importType, deleteOnly: true });
    }

    if (!payload.deleteOnly && payload.importType == importType.manual) {
        await storage.set(storageKeys.importStatus, { isInProgress: false });
    }

    console.log('history queue completed', payload, { importId: payload.importId });
});

export const historyQueueHandler = resolver.getDefinitions();