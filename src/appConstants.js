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
export const importHistoryDelayInSeconds = 500;
export const maxEventPerRequestInQueue = 50;
export const storageKeys = {
    autoImportConfig: 'autoImportConfig',
    importConfiguration: 'importConfiguration',
    credentials: 'credentials',
    importDetails: 'import-details',
    importHistory: 'import-history',
    importStatus: 'importStatus',
    oneTimeImportConfig: 'oneTimeImportConfig'
}
export const importType = {
    auto: 'auto',
    manual: 'manual'
}
export const importIssuesDealyInSeconds = 10;
export const appQueueDealyInSeconds = 30;
export const importBatchSize = 500;
export const maxAllowedQueueDelayInSeconds = 900;