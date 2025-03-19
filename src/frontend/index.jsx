{/*
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
 */}
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Tabs,
  Tab,
  TabList,
  TabPanel,
  Box,
  Tooltip
} from '@forge/react';
import { invoke } from '@forge/bridge';
import ImportConfiguration from './importConfiguration';
import OneTimeImport from './oneTimeImport';
import ImportHistory from './importHistory';
import Login from './login';
import AutoImport from './autoImport';
import { AppContextProvider, useAppContext } from './context/appContext';

const App = () => {

  const [importHistory, setImportHistory] = useState([]);
  const [importCursor, setImportCursor] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [refreshConfig, setRefreshConfig] = useState(false);
  const [isCredsExpired, setisCredsExpired] = useState(false);

  useEffect(async () => {
    const initializeImportHistory = async () => {
      setIsLoading(true);
      const importHistory = await fetchImportHistory();
      setImportHistory(importHistory.data);
      setImportCursor(importHistory.cursor);
      setIsLoading(false);
    }
    initializeImportHistory();

  }, []);

  const fetchImportHistory = async () => {
    try {

      const data = await invoke('getImportHistory', { nextCursor: null });
      console.log("import history : ", data);
      return data;
    } catch (error) {
      console.error("Error fetching import history:", error);
      return [];
    }
  };

  const handleTabChange = async (index) => {

    if (index == 4) {
      setIsLoading(true);
      const historyData = await fetchImportHistory();
      setImportCursor(historyData.cursor);
      setImportHistory(historyData.data);
      setIsLoading(false);
    }
  }

  const handleRefreshConfig = () => {
    setRefreshConfig(prev => !prev);
  }

  const handleExpiredCredsChange = (val) => {
    setisCredsExpired(val);
  }

  return (
    <>

      <AppContextProvider>
        <Tabs id="default" onChange={handleTabChange}>
          <TabList>
          <Tooltip content="Save AppScan credentials"><Tab>Credentials</Tab></Tooltip>
          <Tooltip content="Configure your import settings"><Tab>Configuration</Tab></Tooltip>
          <Tooltip content="Import one-time"><Tab>One-time import</Tab></Tooltip>
          <Tooltip content="Schedule an automatic import"><Tab>Automatic import</Tab></Tooltip>
          <Tooltip content="View import history"><Tab>History</Tab></Tooltip>
          </TabList>

          <TabPanel>
            <Login isCredsExpired={isCredsExpired} onCredsExpiredChange={handleExpiredCredsChange} onRefreshConfig={handleRefreshConfig} />
          </TabPanel>
          <TabPanel>
            <ImportConfiguration isCredsExpired={isCredsExpired} refreshConfigFlag={refreshConfig} />
          </TabPanel>
          <TabPanel>
            <OneTimeImport isCredsExpired={isCredsExpired} />
          </TabPanel>
          <TabPanel>
            <AutoImport isCredsExpired={isCredsExpired} />
          </TabPanel>
          <TabPanel>
            <ImportHistory history={importHistory} isLoading={isLoading} cursor={importCursor} />
          </TabPanel>
        </Tabs>
      </AppContextProvider>
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
