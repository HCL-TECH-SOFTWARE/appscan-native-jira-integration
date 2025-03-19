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
    Form,
    FormSection,
    useForm,
    FormFooter,
    RequiredAsterisk,
    RadioGroup,
    Textfield,
    Select,
    Button,
    Label,
    Box,
    Stack,
    Text,
    Tag,
    HelperMessage,
    SectionMessage,
    ErrorMessage,
    Spinner,
    Heading
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { getHourTextFromValue, getSuffixNumberFromNumber } from './utils';
import DefaultLoader from './components/defaultLoader';
import { storageKeys } from '../appConstants';
import messages from './messages';

const hours = [...Array(24).keys()].map((hour) => (
    {
        label: getHourTextFromValue(hour),
        value: hour
    }
));

const dates = [...Array.from({ length: 31 }, (_, i) => i + 1)].map((d) => (
    {
        label: d,
        value: d
    }
))

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
    {
        label: day,
        value: index
    }
));

const AutoImport = ({ isCredsExpired }) => {
    const [selectedHour, setSelectedHour] = useState(hours.find(x => x.value == 0));
    const [selectedDate, setSelectedDate] = useState(dates.find(x => x.value == 1));
    const [selectedFreq, setSelectedFreq] = useState('hourly');
    const [selectedDay, setSelectedDay] = useState(weekdays.find(x => x.label == 'Sunday'));
    const [maxIssues, setMaxIssues] = useState(25);
    const [showLoader, setShowLoader] = useState(true);
    const [isAutoImportScheduled, setIsAutoImportScheduled] = useState(false);
    const { handleSubmit, register, getFieldId, formState } = useForm();
    const { errors, isSubmitting } = formState;

    useEffect(() => {
        const fillAutoImpoprtConfig = async () => {
            const config = await invoke('storage', { storageKey: storageKeys.autoImportConfig, type: "GET" });
            if (config && Object.keys(config).length != 0) {
                setSelectedFreq(config.frequency ? config.frequency : 'hourly');
                const configuredHour = config.hour ? config.hour : 0;
                setSelectedHour(hours.find(x => x.value == configuredHour));
                const configuredDate = config.localDate ? config.localDate : 1
                setSelectedDate(dates.find(x => x.value == configuredDate));
                const configuredDay = config.localWeekDay && Object.keys(config.localWeekDay).length != 0 ? config.localWeekDay.day : 'Sunday';
                setSelectedDay(weekdays.find(x => x.label == configuredDay));
                setMaxIssues(config.maxIssues ? config.maxIssues : 25);
            }
            setShowLoader(false);
        }
        fillAutoImpoprtConfig();

    }, []);


    const handleImportAutomation = async () => {
        setIsAutoImportScheduled(false);
        const currentDateTime = new Date();
        currentDateTime.setHours(selectedHour.value, 0, 0);
        if (selectedFreq == 'hourly') {
            currentDateTime.setHours(0, 0, 0);
        }
        else if (selectedFreq == 'monthly') {
            currentDateTime.setDate(selectedDate.value);
        }
        else if (selectedFreq == 'weekly') {
            const currentDay = currentDateTime.getDay();
            let dayDiff = selectedDay.value - currentDay;
            if (dayDiff < 0) {
                dayDiff = dayDiff + 7;
            }
            const newDate = currentDateTime.getDate() + dayDiff;
            currentDateTime.setDate(newDate);
            console.log('currentDateTime', currentDateTime);
            console.log('day', currentDateTime.getUTCDay());

        }
        const utcTime = currentDateTime.toUTCString();
        const autoImportSchedule = {
            frequency: selectedFreq,
            localDate: selectedDate.value,
            localWeekDay: { day: selectedDay.label, dayNum: selectedDay.value },
            date: currentDateTime.getUTCDate(),
            weekDay: { day: weekdays[currentDateTime.getUTCDay()].label, dayNum: currentDateTime.getUTCDay() },
            hour: selectedHour.value,
            maxIssues: maxIssues,
            time: utcTime
        }

        console.log(autoImportSchedule);

        await invoke('storage', { formData: autoImportSchedule, storageKey: storageKeys.autoImportConfig, type: "POST" });
        setIsAutoImportScheduled(true);
    };


    const handleHourChange = (selectedItem) => {
        setSelectedHour(selectedItem);
        setIsAutoImportScheduled(false);
    };

    const handleFreqChange = (e) => {
        setSelectedFreq(e.target.value);
        setIsAutoImportScheduled(false);
    }

    const handleDateChange = (selectedItem) => {
        setSelectedDate(selectedItem);
        setIsAutoImportScheduled(false);
    }

    const handleDayChange = (selectedItem) => {
        setSelectedDay(selectedItem);
        setIsAutoImportScheduled(false);
    }

    const handleMaxIssuesChange = (e) => {
        setMaxIssues(e.target.value);
        setIsAutoImportScheduled(false);
    }

    return (
        <>
            <Box xcss={{
                width: '35%',
                position: 'relative'
            }}>
                {showLoader ? <DefaultLoader /> :
                    <Form onSubmit={handleSubmit(handleImportAutomation)}>
                        {isCredsExpired ? <Box xcss={{marginTop:'space.100'}} > <SectionMessage appearance="error">
                            <Text>{messages.expiredCredentials}</Text>
                        </SectionMessage></Box>: ''}
                        <FormSection>
                            <Stack space="space.100">
                                
                            <Box xcss={{marginBottom:'space.100',marginTop:'space.0'}} >
                                    
                                    <Heading  as="h3">
                                    Schedule an automatic import
                                    </Heading>
                                </Box>
                                <Box>
                                    <Label labelFor={getFieldId("frequency")}>
                                        Frequency
                                        <RequiredAsterisk />
                                    </Label>
                                    <RadioGroup
                                        {...register("frequency")}
                                        onChange={handleFreqChange}
                                        options={[
                                            { name: 'hourly', value: 'hourly', label: 'Hourly' },
                                            { name: 'daily', value: 'daily', label: 'Daily' },
                                            { name: 'weekly', value: 'weekly', label: 'Weekly' },
                                            { name: 'monthly', value: 'monthly', label: 'Monthly' }
                                        ]}
                                        defaultValue={selectedFreq}
                                        value={selectedFreq}
                                        isDisabled={isSubmitting}
                                    >
                                    </RadioGroup>
                                    <HelperMessage>Select issue import frequency</HelperMessage>
                                </Box>

                                <Box>
                                    <Label labelFor={getFieldId("maxIssues")}>
                                        Max issues per application per import
                                        <RequiredAsterisk />
                                    </Label>
                                    <Textfield
                                        {...register("maxIssues", {
                                            required: !maxIssues,
                                        })}
                                        value={maxIssues}
                                        defaultValue={maxIssues}
                                        onChange={handleMaxIssuesChange}
                                        type='number'
                                        isDisabled={isSubmitting}
                                    />
                                    {errors["maxIssues"] && (
                                        <ErrorMessage>{messages.invalidMaxIssues}</ErrorMessage>
                                    )}
                                </Box>
                                {selectedFreq == 'weekly' ?
                                    <Box >
                                        <Label labelFor={getFieldId("day")}>
                                            Day
                                            <RequiredAsterisk />
                                        </Label>
                                        <Select
                                            appearance='default'
                                            {...register("day")}
                                            options={weekdays}
                                            value={selectedDay}
                                            defaultValue={selectedDay}
                                            onChange={handleDayChange}
                                            isDisabled={isSubmitting}
                                        >
                                        </Select>
                                    </Box>
                                    : ""}

                                {selectedFreq == 'monthly' ?
                                    <Box >
                                        <Label labelFor={getFieldId("date")}>
                                            Date
                                            <RequiredAsterisk />
                                        </Label>
                                        <Select
                                            appearance='default'
                                            {...register("date")}
                                            options={dates}
                                            value={selectedDate}
                                            defaultValue={selectedDate}
                                            onChange={handleDateChange}
                                            isDisabled={isSubmitting}
                                        >
                                        </Select>
                                    </Box>
                                    : ""}

                                {selectedFreq != 'hourly' ?
                                    <Box >
                                        <Label labelFor={getFieldId("hour")}>
                                            Hour
                                            <RequiredAsterisk />
                                        </Label>
                                        <Select
                                            appearance='default'
                                            {...register("hour")}
                                            options={hours}
                                            value={selectedHour}
                                            defaultValue={selectedHour}
                                            onChange={handleHourChange}
                                            isDisabled={isSubmitting}
                                        >
                                        </Select>
                                    </Box>
                                    : ""}

                                {isAutoImportScheduled ?
                                    <SectionMessage appearance="success">
                                        <Text>{messages.autoImportSuccess}</Text>
                                    </SectionMessage>
                                    : ''}

                            </Stack>

                        </FormSection>
                        <FormFooter align='start'>
                            <Button appearance="primary" isDisabled={isSubmitting} type="submit">
                                Schedule auto import {isSubmitting ? <Spinner appearance='inherit' size={'medium'} /> : ''}
                            </Button>
                        </FormFooter>
                    </Form >
                }

            </Box >

        </>
    )
}



export default AutoImport