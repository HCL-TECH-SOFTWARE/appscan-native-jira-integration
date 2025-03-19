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
import React from 'react';
import {
    Stack,
    Box,
    Inline
} from '@forge/react';

export const TableCell = ({ children }) => {
    return (
        <Box xcss={{
            padding: 'space.100',
            paddingBlock: 'space.250',
            borderBottomLeftRadius: 'border.radius',
            borderBottomStyle: 'solid',
            borderBottomWidth: 'border.width',
            borderBottomColor: 'color.border.accent.gray',
            width: '100%',
            height: '60px'
        }}>
            {children}
        </Box>
    );
};

export const TableInputCell = ({ children }) => {
    return (
        <Box xcss={{
            padding: 'space.100',
            borderBottomRightRadius: 'border.radius',
            borderBottomStyle: 'solid',
            borderBottomWidth: 'border.width',
            borderBottomColor: 'color.border.accent.gray',
            width: '100%',
            height: '60px'
        }}>
            {children}
        </Box>
    );
};


export const TableHeader = ({ children }) => {
    return (
        <Box xcss={{
            padding: 'space.100',
            borderBottomLeftRadius: 'border.radius',
            borderBottomRightRadius: 'border.radius',
            borderBottomStyle: 'solid',
            borderBottomWidth: 'border.width',
            borderBottomColor: 'color.border.accent.gray',
            width: '100%',
            height: '40px'
        }}>
            {children}
        </Box>
    );
};

export const TableRow = ({ children }) => {
    return (
        <Inline>
            {children}
        </Inline>
    );
};

export const Table = ({ headers, rows }) => {
    return (
        <Stack>
            {/* Table headers */}
            <TableRow>
                {headers.map((header, index) => (
                    <TableHeader key={index}>{header}</TableHeader>
                ))}
            </TableRow>
            {/* Table rows */}
            {rows.map((rowData, rowIndex) => (
                <TableRow key={rowIndex}>
                    {rowData.map((cellData, cellIndex) => (
                        <TableCell key={cellIndex}>{cellData}</TableCell>
                    ))}
                </TableRow>
            ))}
        </Stack>
    );
};