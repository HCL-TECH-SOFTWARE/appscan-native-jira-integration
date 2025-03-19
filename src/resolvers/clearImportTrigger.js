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
 * The purpose of this trigger is to stop any long running import which ran into any error.
 */
export const clearImportTrigger = async function webtriggerhandler() {
    const logKey = 'clearImportTrigger'
    console.log('clearImport trigger called', logKey);
    await storage.set(storageKeys.importStatus, { isInProgress: false });
    console.log('clearImport trigger completed', logKey);

}