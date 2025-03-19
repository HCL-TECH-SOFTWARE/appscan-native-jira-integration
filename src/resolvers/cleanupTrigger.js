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

import { storage } from "@forge/api";
import { storageKeys } from '../appConstants';

/**
 * The purpose of this trigger is to clean up records/data which are no longer needed.
 * This will help us to keep the forge storage lighter by deleting old records
 */
export const cleanupTrigger = async function webtriggerhandler() {
    const logKey = 'cleanupTrigger'
    console.log('cleanup trigger called', logKey);
    const startTime = new Date().getTime();
    let itemsToRemove = [];

    let cursor = null;
    do {
        const results = await storage
            .entity(storageKeys.importDetails)
            .query()
            .index('importId')
            .limit(20)
            .cursor(cursor)
            .getMany()
        itemsToRemove = [...itemsToRemove, ...results.results]
        cursor = results.nextCursor;

        if (itemsToRemove.length >= 500) {
            break;
        }
    }
    while (cursor)

    const currentTime = Date.now();
    console.log('dirty records', itemsToRemove.length, itemsToRemove, logKey)
    itemsToRemove = itemsToRemove.filter(x => (currentTime - x.value.dateTime) / (1000 * 60 * 60) > 12); // delete records more than 12 hours old
    console.log('total records to be deleted', itemsToRemove.length, logKey);
    console.log('records to be deleted', itemsToRemove, logKey)

    if (itemsToRemove && itemsToRemove.length) {
        const importKeys = itemsToRemove.map(item => item.key);
        for (const key of importKeys) {
            const endTime = new Date().getTime();
            const totalTime = (endTime - startTime) / 1000;
            if (totalTime > 20) { //stop the job if it is more than 20 seconds to accomodate 25 seconds limit
                break;
            }
            await storage.entity(storageKeys.importDetails).delete(key);
        }
    }
    console.log('cleanup trigger completed', logKey);

}