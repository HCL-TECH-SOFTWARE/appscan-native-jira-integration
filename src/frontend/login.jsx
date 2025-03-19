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
    FormFooter,
    useForm,
    RequiredAsterisk,
    Stack,
    Box,
    Textfield,
    Button,
    ErrorMessage,
    SectionMessage,
    Label,
    Heading,
    Text,
    Spinner,
    
} from '@forge/react';
import { invoke } from '@forge/bridge';
import DefaultLoader from './components/defaultLoader';
import { storageKeys } from '../appConstants';
import { useAppContext } from './context/appContext';
import messages from './messages';


const Login = ({ onRefreshConfig, isCredsExpired, onCredsExpiredChange }) => {
    const [url, setUrl] = useState('');
    const [keyId, setKeyId] = useState('');
    const [keySecret, setKeySecret] = useState('');
    const [isLoginDataSaved, setLoginDataSaved] = useState(false);
    const [isLoginDataError, setLoginDataError] = useState(false);
    const [showLoader, setShowLoader] = useState(true);
    const [tenantId, setTenantId] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const { handleSubmit, register, getFieldId, formState } = useForm();
    const { errors, isSubmitting } = formState;

    const { loginStorage, setLoginStorage } = useAppContext();

    useEffect(() => {
        const fillLoginDetails = async () => {
            const credentials = await invoke('secretStorage', { storageKey: storageKeys.credentials, type: "GET" });
            setLoginStorage(credentials);
            if (credentials && Object.keys(credentials).length != 0) {
                setKeyId(credentials.keyId);
                setUrl(credentials.url);
                setKeySecret(credentials.keySecret);

                const data = await invoke('login', { url: credentials.url, keyId: credentials.keyId, keySecret: credentials.keySecret });

                if (data.hasOwnProperty("Message")) {
                    onCredsExpiredChange(true);
                }
                else {
                    const tenantInfo = await invoke('getTenantInfo', { url: credentials.url, authorizationHeader: `Bearer ${data.Token}` });
                    if (tenantInfo.header.ok) {
                        setTenantId(tenantInfo.data.TenantId);
                    }
                }
            } else {
                setKeyId("");
                setUrl("https://cloud.appscan.com");
                setKeySecret("");
            }

            setShowLoader(false);
        }

        fillLoginDetails();

    }, []);

    const saveLoginDetails = async (formData) => {
        setLoginDataSaved(false);
        setLoginDataError(false);
        const validationErrors = {};
        let currentUrl = url;
        let currentTenatId = '';
        try {

            if (currentUrl.charAt(currentUrl.length - 1) === '/') {
                currentUrl = currentUrl.slice(0, -1);
                setUrl(currentUrl);
            }
            const data = await invoke('login', { url: currentUrl, keyId: keyId, keySecret: keySecret });
            if (data.hasOwnProperty("Message")) {
                validationErrors.message = data.Message;
            }
            else {
                const tenantInfo = await invoke('getTenantInfo', { url: currentUrl, authorizationHeader: `Bearer ${data.Token}` });
                if (tenantInfo.header.ok) {
                    currentTenatId = tenantInfo.data.TenantId;
                }
            }
        } catch (error) {
            setShowLoader(false);
            console.error("Error in authentication:", error);
            validationErrors.message = "Unable to authenticate";
        }


        if (Object.keys(validationErrors).length > 0) {

            console.log("Validation errors:", validationErrors);

            setLoginDataError(true);
            setErrorMessage(messages.authenticationError);
            return;
        }
        setLoginDataError(false);
        await saveLoginData(currentUrl);
        await resetConfiguration(currentTenatId);
        setLoginDataSaved(true);

    };

    const saveLoginData = async (currentUrl) => {
        try {

            await invoke('secretStorage', { formData: { url: currentUrl, keyId: keyId, keySecret: keySecret }, storageKey: storageKeys.credentials, type: "POST" });
            setLoginStorage({ url: currentUrl, keyId: keyId, keySecret: keySecret });
            console.log("login data saved successfully!");
        } catch (error) {
            console.error("Error saving login data:", error);
            setLoginDataSaved(false);
        }
    };

    const resetConfiguration = async (currentTenatId) => {
        try {
            if (isCredsExpired) {
                onRefreshConfig(true);
                onCredsExpiredChange(false);
            }
            if (tenantId != currentTenatId) {
                const importConfig = await invoke('storage', { storageKey: storageKeys.importConfiguration, type: "GET" });
                if (importConfig && Object.keys(importConfig).length != 0 && importConfig.applicationId.length > 0 && importConfig.applicationId.every(x => x.value != 'all') && !isCredsExpired) {
                    importConfig.applicationId = [];
                }
                await invoke('storage', { formData: importConfig, storageKey: storageKeys.importConfiguration, type: "POST" });
                setTenantId(currentTenatId);
                onRefreshConfig(true);
            }

        } catch (error) {
            console.error("Error resetting import configuration:", error);
        }
    };

    const handleUrlChange = (e) => {
        setUrl(e.target.value);
    }

    const handleKeyIdChange = (e) => {
        setKeyId(e.target.value);
    }

    const handleSecretChange = (e) => {
        setKeySecret(e.target.value);
    }

    return (
        <>

            <Box xcss={{
                width: '35%',
                position: 'relative'
            }}>
                {showLoader ? <DefaultLoader /> :

                    <Form onSubmit={handleSubmit(saveLoginDetails)}>
                        {isCredsExpired ?   <Box xcss={{marginTop:'space.100'}} ><SectionMessage appearance="error">
                            <Text>{messages.expiredCredentials}</Text>
                        </SectionMessage></Box> : ''}
                        <FormSection>
                            <Stack space="space.100">
                                <Box >
                                    <Label labelFor={getFieldId("url")}>
                                        Service URL
                                        <RequiredAsterisk />
                                    </Label>
                                    <Textfield
                                        {...register("url", {
                                            required: !url,
                                        })}
                                        value={url}
                                        defaultValue={url}
                                        onChange={handleUrlChange}
                                        isDisabled={isSubmitting}
                                    />
                                    {errors["url"] && (
                                        <ErrorMessage>{messages.invalidURL}</ErrorMessage>
                                    )}
                                </Box>

                                <Box>
                                    <Label labelFor={getFieldId("keyId")}>
                                        Key ID
                                        <RequiredAsterisk />
                                    </Label>
                                    <Textfield
                                        {...register("keyId", {
                                            required: !keyId,
                                        })}
                                        value={keyId}
                                        defaultValue={keyId}
                                        onChange={handleKeyIdChange}
                                        isDisabled={isSubmitting}
                                    />
                                    {errors["keyId"] && (

                                        <ErrorMessage>{messages.invalidKeyID}</ErrorMessage>

                                    )}
                                </Box>

                                <Box>
                                    <Label labelFor={getFieldId("keySecret")}>
                                        Key secret
                                        <RequiredAsterisk />
                                    </Label>
                                    <Textfield
                                        type="password"
                                        {...register("keySecret", { required: !keySecret })}
                                        value={keySecret}
                                        defaultValue={keySecret}
                                        onChange={handleSecretChange}
                                        isDisabled={isSubmitting}
                                    />
                                    {errors["keySecret"] && (

                                        <ErrorMessage>{messages.invalidSecret}</ErrorMessage>

                                    )}
                                </Box>

                               
                                <>
                                    {isLoginDataError && (
                                        <SectionMessage title="Error!" appearance="error">
                                            <Text>{errorMessage}</Text>
                                        </SectionMessage>
                                    )}
                                </>

                                <>
                                    {isLoginDataSaved && (
                                        <SectionMessage appearance='success'>
                                            <Text>{messages.authenticationSuccess}</Text>
                                        </SectionMessage>
                                    )}
                                </>
                            </Stack>

                        </FormSection>
                        <FormFooter align='start'>
                            <Button appearance="primary" isDisabled={isSubmitting} type="submit" >
                                Save and verify credentials {isSubmitting ? <Spinner appearance='inherit' size={'medium'} /> : ''}
                            </Button>
                        </FormFooter>
                    </Form >
                }
            </Box >

        </>
    )
}



export default Login