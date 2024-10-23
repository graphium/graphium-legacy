import * as AWS from 'aws-sdk';
import * as FormData from 'form-data';
import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';

export enum ConfigGroup {
    ORG = 'org-db',
    INDEX = 'index-db',
    CACHE = 'cache',
    AUTH0 = 'auth0',
    SCORECARDEMAIL = 'daily-facility-scorecard-email',
    FRAMEWORKDB = 'framework-db',
    MANDRILL = 'mandrill',
    PATIENT_ATTACHMENTS = 'patient-attachments',
}

export interface ConfigParameter {
    group: string;
    name: string;
    value: string;
}

export class EnvironmentConfig {
    static LOCAL = 'local';
    static DEV = 'dev';
    static PRO = 'pro';
    static STAGE = 'stage';

    private static parameters: ConfigParameter[];
    private static secretsManager: AWS.SecretsManager;
    private static configLoaded: boolean = false;
    private static groupsLoaded: string[] = [];
    private static _environment: string;

    private static validateEnvironment(environment: string) {
        if (['local', 'pro', 'stage', 'dev', 'test'].indexOf(environment) < 0) {
            throw new Error(`Invalid environment (${environment}), unable to load environment config.`);
        }
    }

    private static async loadGroupFromAws(group: string, environment: string): Promise<ConfigParameter[]> {
        let getSecretResult: AWS.SecretsManager.GetSecretValueResponse;
        try {
            getSecretResult = await this.secretsManager
                .getSecretValue({
                    SecretId: `${environment}/config/group/${group}`,
                })
                .promise();
            this.groupsLoaded.push(group);
        } catch (error) {
            if (error.code == 'ResourceNotFoundException') {
                throw new Error(`Unable to find group config for environment (${environment}:${group}).`);
            } else {
                throw error;
            }
        }

        let configObject = JSON.parse(getSecretResult.SecretString);
        let configParameters: ConfigParameter[] = [];

        Object.keys(configObject).forEach((key) => {
            let value = configObject[key];
            configParameters.push({
                value: value as string,
                name: key,
                group: group,
            });
        });

        return configParameters;
    }

    private static async loadGroupFromLocal(group: string): Promise<ConfigParameter[]> {
        let getSecretResult: AxiosResponse;
        try {
            let formData = new FormData();
            formData.append('SecretId', group);

            const config: AxiosRequestConfig = {
                method: 'POST',
                url: 'http://secretsmanager:4999',
                data: formData,
                headers: formData.getHeaders(),
            };
            config.headers = {
                ...config.headers,
                'x-amz-target': 'SecretsManager.GetSecretValue',
                accept: '*/*',
                'cache-control': 'no-cache',
                connection: 'keep-alive',
            };
            getSecretResult = await axios(config);
            this.groupsLoaded.push(group);
        } catch (error) {
            if (error.code == 'ResourceNotFoundException') {
                throw new Error(`Unable to find group config for environment (${group}).`);
            } else {
                throw error;
            }
        }

        let configObject = JSON.parse(getSecretResult.data.SecretString);
        let configParameters: ConfigParameter[] = [];

        Object.keys(configObject).forEach((key) => {
            let value = configObject[key];
            configParameters.push({
                value: value as string,
                name: key,
                group: group,
            });
        });

        return configParameters;
    }

    static isConfigLoaded(): boolean {
        return this.configLoaded;
    }

    static loadConfigData(parameters: ConfigParameter[]) {
        if (this.configLoaded) {
            throw new Error('Unable to load config parameters, config already loaded.');
        }

        this.groupsLoaded = parameters.map((p) => p.group);

        this.parameters = parameters;
        this.configLoaded = true;
    }

    static get environment(): string {
        return this._environment;
    }

    static async loadConfig(groups: string[], environment: string) {
        this.validateEnvironment(environment);
        EnvironmentConfig._environment = environment;

        if (environment === EnvironmentConfig.LOCAL) {
            this.parameters = [];
            for (var group of groups) {
                let groupParameters = await this.loadGroupFromLocal(group);
                this.parameters = this.parameters.concat(groupParameters);
            }
        } else {
            if (!this.secretsManager) {
                this.secretsManager = new AWS.SecretsManager({
                    apiVersion: '2017-10-17',
                    region: "us-east-1",
                });
            }

            this.parameters = [];
            for (var group of groups) {
                let groupParameters = await this.loadGroupFromAws(group, environment);
                this.parameters = this.parameters.concat(groupParameters);
            }
        }

        this.configLoaded = true;
    }

    static getProperty(group: string, propertyName: string): string {
        if (!this.configLoaded) {
            throw new Error('Unable to get property, no config has been loaded.');
        }

        if(!this.groupsLoaded.includes(group)) {
            throw new Error(`Unable to get property, group ${group} has not been loaded.`);
        }

        let property = this.parameters.find((p) => {
            return p.name == propertyName && p.group == group;
        });
        if (property != null) {
            return property.value;
        } else {
            throw new Error(`Property ${propertyName} not defined in group ${group}.`);
        }
    }

    static getParameters(): ConfigParameter[] {
        return this.parameters;
    }
}
