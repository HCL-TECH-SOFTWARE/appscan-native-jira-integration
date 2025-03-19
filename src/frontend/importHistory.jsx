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
import {
    DynamicTable,
    SectionMessage,
    Text,
    Box,
    Button,
    Icon,
    Inline,
    Heading
} from '@forge/react';
import { invoke } from '@forge/bridge';

const head = {
    cells: [
        {
            key: 'importId',
            content: 'Import ID',
            isSortable: false
        },
        {
            key: "lastRun",
            content: "Last run date/time",
            isSortable: true,
        },
        {
            key: "importType",
            content: "Import type",
            isSortable: true,
        },
        {
            key: "issueImported",
            content: "Issues imported",
            isSortable: true,
        },
        {
            key: "importStatus",
            content: "Import status",
            isSortable: true,
        },
    ],
};

const ImportHistory = ({ history, isLoading, cursor }) => {

    const [isNewDataLoading, setisNewDataLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [importCursor, setImportCursor] = useState();
    const [importHistory, setImportHistory] = useState([]);

    useEffect(() => {
        setImportHistory(history);
        updateTable(history);
        setImportCursor(cursor);
    }, [history]);

    const createKey = (input) => {
        return input ? input.replace(/^(the|a|an)/, "").replace(/\s/g, "") : input;
    }

    const fetchImportHistory = async () => {
        try {
            setisNewDataLoading(true);
            const data = await invoke('getImportHistory', { nextCursor: importCursor });
            setImportHistory(prev => [...prev, ...data.data]);
            updateTable([...importHistory, ...data.data]);
            setImportCursor(data.cursor);
        } catch (error) {
            console.error("Error fetching import history:", error);
        }
        setisNewDataLoading(false);
    };

    const updateTable = (data) => {
        const tableRows = data.map((item, index) => ({
            key: `row-${index}-${item.dateTime}`,
            cells: [
                {
                    key: createKey(item.importId),
                    content: <Text>{item.importId}</Text>,
                },
                {
                    key: createKey(item.dateTime),
                    content: <Text>{(new Date(parseInt(item.dateTime))).toLocaleString()}</Text>,
                },
                {
                    key: createKey(item.importType),
                    content: item.importType,
                },
                {
                    key: item.issueCount,
                    content: item.issueCount,
                },
                {
                    key: item.issueCount,
                    content: item.status ? 'Success' : 'Failure',
                },
            ],
        }));
        setRows(tableRows);
    }




    return (
        <>
            <Box xcss={{ width: '100%' }}>
                
            <Box xcss={{marginBottom:'space.100',marginTop:'space.200'}} >
                                    
                                    <Heading  as="h3">
                                    Issue import job details
                                    </Heading>
                </Box>
                <DynamicTable
                    head={head}
                    rows={rows}
                    loadingSpinnerSize='large'
                    isLoading={isLoading || isNewDataLoading}
                    emptyView='No records found'
                />
                {history && history.length > 0 && importCursor ? <Box xcss={{ marginTop: 'space.negative.300' }}>
                    <Button shouldFitContainer onClick={fetchImportHistory}><Inline alignInline='center'><Box>Load more records</Box> <Box xcss={{ marginTop: 'space.050' }}><Icon glyph="refresh" label="refresh" /></Box></Inline></Button>
                </Box> : ''}
            </Box >
        </>
    )
}



export default ImportHistory