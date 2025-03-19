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
import { timerQueue } from './queues';
import { storageKeys } from '../appConstants';

/**
 * This trigger initiates auto import job.
 * it will run every hour and check from the auto import config if it should execute the job
 */
export const trigger = async function webtriggerhandler() {
    console.log('trigger called');
    const autoImportConfig = await storage.get(storageKeys.autoImportConfig);
    console.log('auto import config', autoImportConfig);

    if (autoImportConfig && Object.keys(autoImportConfig).length != 0) {
        const frequency = autoImportConfig.frequency;
        let configDateTime = new Date(autoImportConfig.time);
        const currentDateTime = new Date();
        const configTimeInMinutes = (configDateTime.getUTCHours() * 60) + configDateTime.getUTCMinutes();
        const currentTimeInMinutes = (currentDateTime.getUTCHours() * 60) + currentDateTime.getUTCMinutes();
        let diffTime = 0;
        if (currentTimeInMinutes < configTimeInMinutes) {
            diffTime = configTimeInMinutes - currentTimeInMinutes;
        }
        else {
            diffTime = (24 * 60) - (currentTimeInMinutes - configTimeInMinutes);
        }

        console.log('diffTime', diffTime);
        let isJobRun = diffTime < 60 && diffTime >= 0;

        if (frequency == 'daily') {
            console.log('Daily trigger called')
        }
        else if (frequency == 'weekly') {
            const weekday = autoImportConfig.weekDay.dayNum;
            const currentWeekday = (new Date()).getUTCDay();
            console.log('Weekly trigger called')
            isJobRun = isJobRun && weekday == currentWeekday;
        }
        else if (frequency == 'monthly') {
            const currentDate = (new Date()).getUTCDate();
            const configDate = autoImportConfig.date;
            console.log('monthly trigger called')
            isJobRun = isJobRun && configDate == currentDate;
        }
        else {
            const configMin = (new Date(configDateTime)).getUTCMinutes();
            let currentTime = new Date();
            currentTime.setMinutes(configMin);
            if (currentDateTime > currentTime) {
                currentTime.setHours(currentTime.getHours() + 1);
            }
            diffTime = Math.floor((currentTime - currentDateTime) / (1000 * 60));
            console.log('diffTime in hours config', diffTime);
            isJobRun = diffTime < 60 && diffTime >= 0;;
        }

        if (isJobRun) {
            console.log(`Auto import will run after ${diffTime} minutes`);
            await timerQueue.push({ diffTime: diffTime * 60, maxIssues: autoImportConfig.maxIssues });
        }
    }
    else {
        console.log('No jobs scheduled')
    }


}
