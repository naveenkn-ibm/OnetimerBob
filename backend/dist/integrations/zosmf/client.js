"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zosmfClient = exports.ZOSMFClient = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const logger_1 = require("../../utils/logger");
class ZOSMFClient {
    config;
    axiosInstance;
    baseUrl;
    constructor(config) {
        // Load configuration from environment or use defaults from VSC1.pdf
        this.config = {
            host: config?.host || process.env.ZOSMF_HOST || '204.90.115.200',
            port: config?.port || parseInt(process.env.ZOSMF_PORT || '10443'),
            protocol: config?.protocol || process.env.ZOSMF_PROTOCOL || 'https',
            account: config?.account || process.env.ZOSMF_ACCOUNT || 'FB3',
            rejectUnauthorized: config?.rejectUnauthorized ??
                (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'),
        };
        this.baseUrl = `${this.config.protocol}://${this.config.host}:${this.config.port}`;
        // Create axios instance with custom HTTPS agent for self-signed certificates
        this.axiosInstance = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 30000, // 30 seconds
            httpsAgent: new https_1.default.Agent({
                rejectUnauthorized: this.config.rejectUnauthorized,
            }),
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-ZOSMF-HEADER': 'true',
            },
        });
        (0, logger_1.logMainframe)('ZOSMFClient initialized', 'SYSTEM', {
            host: this.config.host,
            port: this.config.port,
        });
    }
    /**
     * Authenticate with TSO credentials
     * @param tsoId - TSO user ID (format: Z#####)
     * @param password - TSO password
     * @returns Authentication result with token
     */
    async authenticate(tsoId, password) {
        try {
            (0, logger_1.logMainframe)('Authentication attempt', tsoId, { endpoint: '/zosmf/services/authenticate' });
            // Create Basic Auth header
            const credentials = Buffer.from(`${tsoId}:${password}`).toString('base64');
            const response = await this.axiosInstance.post('/zosmf/services/authenticate', {}, {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                },
            });
            // Extract LTPA token from response
            const ltpaToken = response.headers['set-cookie']?.find((cookie) => cookie.startsWith('LtpaToken2'));
            if (!ltpaToken) {
                (0, logger_1.logError)('Authentication failed: No LTPA token received', undefined, { tsoId });
                return {
                    success: false,
                    error: 'Authentication failed: No token received',
                };
            }
            // Extract session ID if available
            const sessionId = response.data?.sessionId || response.headers['x-session-id'];
            (0, logger_1.logMainframe)('Authentication successful', tsoId);
            return {
                success: true,
                token: ltpaToken,
                sessionId,
                message: 'Authentication successful',
            };
        }
        catch (error) {
            return this.handleAuthError(error, tsoId);
        }
    }
    /**
     * Verify if a session is still valid
     * @param token - LTPA token
     * @returns True if session is valid
     */
    async verifySession(token) {
        try {
            const response = await this.axiosInstance.get('/zosmf/services/info', {
                headers: {
                    'Cookie': token,
                },
            });
            return response.status === 200;
        }
        catch (error) {
            (0, logger_1.logError)('Session verification failed', error);
            return false;
        }
    }
    /**
     * Logout and close z/OSMF session
     * @param token - LTPA authentication token
     * @returns Success status
     */
    async logout(token) {
        try {
            (0, logger_1.logMainframe)('Logout attempt', 'SYSTEM', { endpoint: '/zosmf/services/logout' });
            // Call z/OSMF logout endpoint to invalidate session
            await this.axiosInstance.post('/zosmf/services/logout', {}, {
                headers: {
                    'Cookie': token,
                },
            });
            (0, logger_1.logMainframe)('Logout successful - mainframe session closed', 'SYSTEM');
            return {
                success: true,
                message: 'Mainframe session closed successfully',
            };
        }
        catch (error) {
            (0, logger_1.logError)('Mainframe logout failed', error);
            // Even if logout fails, we still want to clear local session
            return {
                success: true, // Return true to allow frontend cleanup
                message: 'Local session cleared (mainframe logout may have failed)',
            };
        }
    }
    /**
     * Submit JCL job to mainframe
     * @param jclContent - JCL content to submit
     * @param token - LTPA authentication token
     * @returns Job submission result
     */
    async submitJob(jclContent, token) {
        try {
            (0, logger_1.logMainframe)('Submitting JCL job', 'SYSTEM', { jclLength: jclContent.length });
            const response = await this.axiosInstance.put('/zosmf/restjobs/jobs', jclContent, {
                headers: {
                    'Cookie': token,
                    'Content-Type': 'text/plain',
                },
            });
            const jobData = response.data;
            (0, logger_1.logMainframe)('JCL job submitted', 'SYSTEM', {
                jobName: jobData.jobname,
                jobId: jobData.jobid,
            });
            return {
                jobName: jobData.jobname,
                jobId: jobData.jobid,
                owner: jobData.owner,
                status: jobData.status,
                returnCode: jobData.retcode,
            };
        }
        catch (error) {
            (0, logger_1.logError)('JCL submission failed', error);
            throw this.createError(error, 'Failed to submit JCL job');
        }
    }
    /**
     * Get job status
     * @param jobName - Job name
     * @param jobId - Job ID
     * @param token - LTPA authentication token
     * @returns Job status information
     */
    async getJobStatus(jobName, jobId, token) {
        try {
            const response = await this.axiosInstance.get(`/zosmf/restjobs/jobs/${jobName}/${jobId}`, {
                headers: {
                    'Cookie': token,
                },
            });
            const jobData = response.data;
            return {
                jobName: jobData.jobname,
                jobId: jobData.jobid,
                owner: jobData.owner,
                status: jobData.status,
                returnCode: jobData.retcode,
                class: jobData.class,
                completionTime: jobData['exec-ended'],
            };
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get job status', error, { jobName, jobId });
            throw this.createError(error, 'Failed to get job status');
        }
    }
    /**
     * Get job output/logs
     * @param jobName - Job name
     * @param jobId - Job ID
     * @param token - LTPA authentication token
     * @returns Job output content
     */
    async getJobOutput(jobName, jobId, token) {
        try {
            // First, get the list of spool files
            const filesResponse = await this.axiosInstance.get(`/zosmf/restjobs/jobs/${jobName}/${jobId}/files`, {
                headers: {
                    'Cookie': token,
                },
            });
            const files = filesResponse.data;
            let output = '';
            // Retrieve content from each spool file
            for (const file of files) {
                const contentResponse = await this.axiosInstance.get(`/zosmf/restjobs/jobs/${jobName}/${jobId}/files/${file.id}/records`, {
                    headers: {
                        'Cookie': token,
                    },
                });
                output += `\n=== ${file.ddname} (${file.stepname}) ===\n`;
                output += contentResponse.data;
                output += '\n';
            }
            return output;
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get job output', error, { jobName, jobId });
            throw this.createError(error, 'Failed to get job output');
        }
    }
    /**
     * List datasets matching a pattern
     * @param pattern - Dataset name pattern (e.g., "Z12345.*")
     * @param token - LTPA authentication token
     * @returns Array of dataset information
     */
    async listDatasets(pattern, token) {
        try {
            const response = await this.axiosInstance.get(`/zosmf/restfiles/ds`, {
                params: {
                    dslevel: pattern,
                },
                headers: {
                    'Cookie': token,
                },
            });
            const datasets = response.data.items || [];
            return datasets.map((ds) => ({
                name: ds.dsname,
                cataloged: ds.catnm !== undefined,
                volume: ds.vol,
                deviceType: ds.dev,
                organization: ds.dsorg,
                recordFormat: ds.recfm,
                recordLength: ds.lrecl,
                blockSize: ds.blksz,
            }));
        }
        catch (error) {
            (0, logger_1.logError)('Failed to list datasets', error, { pattern });
            throw this.createError(error, 'Failed to list datasets');
        }
    }
    /**
     * Read dataset content
     * @param datasetName - Dataset name
     * @param token - LTPA authentication token
     * @returns Dataset content
     */
    async readDataset(datasetName, token) {
        try {
            const response = await this.axiosInstance.get(`/zosmf/restfiles/ds/${datasetName}`, {
                headers: {
                    'Cookie': token,
                },
            });
            return response.data;
        }
        catch (error) {
            (0, logger_1.logError)('Failed to read dataset', error, { datasetName });
            throw this.createError(error, 'Failed to read dataset');
        }
    }
    /**
     * Get spool files for a job
     * @param jobName - Job name
     * @param jobId - Job ID
     * @param token - LTPA authentication token
     * @returns List of spool files
     */
    async getSpoolFiles(jobName, jobId, token) {
        try {
            (0, logger_1.logMainframe)('Getting spool files', 'SPOOL', { jobName, jobId });
            const response = await this.axiosInstance.get(`/zosmf/restjobs/jobs/${jobName}/${jobId}/files`, {
                headers: {
                    'Cookie': token,
                },
            });
            const spoolFiles = response.data || [];
            (0, logger_1.logMainframe)('Spool files retrieved', 'SPOOL', {
                jobName,
                jobId,
                count: spoolFiles.length
            });
            return spoolFiles;
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get spool files', error, { jobName, jobId });
            throw this.createError(error, 'Failed to get spool files');
        }
    }
    /**
     * Get content of a specific spool file
     * @param jobName - Job name
     * @param jobId - Job ID
     * @param fileId - Spool file ID
     * @param token - LTPA authentication token
     * @returns Spool file content
     */
    async getSpoolContent(jobName, jobId, fileId, token) {
        try {
            (0, logger_1.logMainframe)('Getting spool content', 'SPOOL', { jobName, jobId, fileId });
            const response = await this.axiosInstance.get(`/zosmf/restjobs/jobs/${jobName}/${jobId}/files/${fileId}/records`, {
                headers: {
                    'Cookie': token,
                },
            });
            const content = response.data || '';
            (0, logger_1.logMainframe)('Spool content retrieved', 'SPOOL', {
                jobName,
                jobId,
                fileId,
                length: content.length
            });
            return content;
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get spool content', error, { jobName, jobId, fileId });
            throw this.createError(error, 'Failed to get spool content');
        }
    }
    /**
     * Get dataset member content
     * Supports format: DATASET.NAME(MEMBER) or DATASET.NAME
     * @param datasetName - Dataset name with optional member
     * @param token - LTPA authentication token
     * @returns Dataset/member content
     */
    async getDatasetMember(datasetName, token) {
        try {
            (0, logger_1.logMainframe)('Getting dataset member', 'DATASET', { datasetName });
            // URL encode the dataset name to handle special characters like parentheses
            const encodedDataset = encodeURIComponent(datasetName);
            const response = await this.axiosInstance.get(`/zosmf/restfiles/ds/${encodedDataset}`, {
                headers: {
                    'Cookie': token,
                },
            });
            const content = response.data || '';
            (0, logger_1.logMainframe)('Dataset member retrieved', 'DATASET', {
                datasetName,
                length: content.length
            });
            return content;
        }
        catch (error) {
            (0, logger_1.logError)('Failed to get dataset member', error, { datasetName });
            // Provide more specific error messages
            if (axios_1.default.isAxiosError(error)) {
                const axiosError = error;
                if (axiosError.response?.status === 404) {
                    throw new Error(`Dataset or member not found: ${datasetName}`);
                }
                if (axiosError.response?.status === 403) {
                    throw new Error(`Access denied to dataset: ${datasetName}`);
                }
            }
            throw this.createError(error, 'Failed to get dataset member');
        }
    }
    /**
     * List members of a partitioned dataset (PDS)
     * @param datasetName - Dataset name (without member)
     * @param token - LTPA authentication token
     * @returns Array of member names
     */
    async listDatasetMembers(datasetName, token) {
        try {
            (0, logger_1.logMainframe)('Listing dataset members', 'DATASET', { datasetName });
            const response = await this.axiosInstance.get(`/zosmf/restfiles/ds/${datasetName}/member`, {
                headers: {
                    'Cookie': token,
                },
            });
            const members = response.data.items || [];
            const memberNames = members.map((m) => m.member);
            (0, logger_1.logMainframe)('Dataset members listed', 'DATASET', {
                datasetName,
                count: memberNames.length
            });
            return memberNames;
        }
        catch (error) {
            (0, logger_1.logError)('Failed to list dataset members', error, { datasetName });
            // Provide more specific error messages
            if (axios_1.default.isAxiosError(error)) {
                const axiosError = error;
                if (axiosError.response?.status === 404) {
                    throw new Error(`Dataset not found: ${datasetName}`);
                }
                if (axiosError.response?.status === 400) {
                    throw new Error(`Not a partitioned dataset: ${datasetName}`);
                }
            }
            throw this.createError(error, 'Failed to list dataset members');
        }
    }
    /**
     * Handle authentication errors
     */
    handleAuthError(error, tsoId) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
                (0, logger_1.logError)('Authentication timeout', error, { tsoId });
                return {
                    success: false,
                    error: 'Connection timeout - Mainframe unreachable',
                };
            }
            if (axiosError.response?.status === 401) {
                (0, logger_1.logError)('Invalid credentials', error, { tsoId });
                return {
                    success: false,
                    error: 'Invalid TSO credentials',
                };
            }
            if (axiosError.response?.status === 403) {
                (0, logger_1.logError)('Access forbidden', error, { tsoId });
                return {
                    success: false,
                    error: 'Access forbidden - Check TSO permissions',
                };
            }
            if (!axiosError.response) {
                (0, logger_1.logError)('Network error', error, { tsoId });
                return {
                    success: false,
                    error: 'Mainframe unreachable - Network error',
                };
            }
        }
        (0, logger_1.logError)('Authentication failed', error, { tsoId });
        return {
            success: false,
            error: 'Authentication failed - Unknown error',
        };
    }
    /**
     * Create a standardized error
     */
    createError(error, message) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            const details = axiosError.response?.data || axiosError.message;
            return new Error(`${message}: ${JSON.stringify(details)}`);
        }
        return new Error(`${message}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
exports.ZOSMFClient = ZOSMFClient;
// Export singleton instance
exports.zosmfClient = new ZOSMFClient();
// Made with Bob
//# sourceMappingURL=client.js.map