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
export const getHourTextFromValue = (hour) => {
    return (hour % 12 === 0 ? 12 : hour % 12) + ':00 ' + (hour < 12 ? 'AM' : 'PM');
}

export const getSuffixNumberFromNumber = (number) => {
    if (number > 3 && number < 21) return number + "th";
    switch (number % 10) {
        case 1:
            return number + "st";
        case 2:
            return number + "nd";
        case 3:
            return number + "rd";
        default:
            return number + "th";
    }
}

export const formatDateString = (dateString) => {

    const date = new Date(dateString);
    const options = {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short"
    };
    return date.toLocaleString("en-US", options);
}


export const getAppScanEnv = (url) => {

    const appscanurl = url.toLowerCase();
    let env = "";
    if (appscanurl.includes("eu.cloud.appscan.com")) {
        env = "HCL AppScan - Western Europe";
    } else if (appscanurl.includes("cloud.appscan.com")) {
        env = "HCL AppScan - North America";
    } else if (appscanurl.includes("staging.appscan.com")) {
        env = "HCL AppScan - North America Staging";
    } else if (appscanurl.includes("mirror.appscan.com")) {
        env = "HCL AppScan - North America Mirror"
    } else{
         env = "HCL AppScan 360°"
    }

    return env;
}
export const getAnalyzerType = (input) => {
    const lowerCaseInput = input.toLowerCase();

    switch (lowerCaseInput) {
        case "appscan static analyzer":
            return "AppScan SAST";
        case "appscan dynamic analyzer":
            return "AppScan DAST";
        case "appscan sca analyzer":
            return "AppScan SCA";
        case "appscan interactive analyzer":
            return "AppScan IAST";
        default:
            return "AppScan";
    }
}

export const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}