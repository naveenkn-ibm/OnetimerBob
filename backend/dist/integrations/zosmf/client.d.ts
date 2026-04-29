/**
 * z/OSMF REST API Client for IBM Mainframe Integration
 * Handles TSO authentication, JCL submission, and dataset operations
 *
 * Configuration from VSC1.pdf:
 * - Host: 204.90.115.200
 * - Port: 10443
 * - Protocol: HTTPS
 * - Account: FB3
 */
export interface ZOSMFConfig {
    host: string;
    port: number;
    protocol: string;
    account: string;
    rejectUnauthorized: boolean;
}
export interface AuthenticationResult {
    success: boolean;
    token?: string;
    sessionId?: string;
    message?: string;
    error?: string;
}
export interface JobSubmitResult {
    jobName: string;
    jobId: string;
    owner: string;
    status: string;
    returnCode?: string;
}
export interface JobStatus {
    jobName: string;
    jobId: string;
    owner: string;
    status: string;
    returnCode?: string;
    class?: string;
    completionTime?: string;
}
export interface DatasetInfo {
    name: string;
    cataloged: boolean;
    volume?: string;
    deviceType?: string;
    organization?: string;
    recordFormat?: string;
    recordLength?: number;
    blockSize?: number;
}
export declare class ZOSMFClient {
    private config;
    private axiosInstance;
    private baseUrl;
    constructor(config?: Partial<ZOSMFConfig>);
    /**
     * Authenticate with TSO credentials
     * @param tsoId - TSO user ID (format: Z#####)
     * @param password - TSO password
     * @returns Authentication result with token
     */
    authenticate(tsoId: string, password: string): Promise<AuthenticationResult>;
    /**
     * Verify if a session is still valid
     * @param token - LTPA token
     * @returns True if session is valid
     */
    verifySession(token: string): Promise<boolean>;
    /**
     * Logout and close z/OSMF session
     * @param token - LTPA authentication token
     * @returns Success status
     */
    logout(token: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Submit JCL job to mainframe
     * @param jclContent - JCL content to submit
     * @param token - LTPA authentication token
     * @returns Job submission result
     */
    submitJob(jclContent: string, token: string): Promise<JobSubmitResult>;
    /**
     * Get job status
     * @param jobName - Job name
     * @param jobId - Job ID
     * @param token - LTPA authentication token
     * @returns Job status information
     */
    getJobStatus(jobName: string, jobId: string, token: string): Promise<JobStatus>;
    /**
     * Get job output/logs
     * @param jobName - Job name
     * @param jobId - Job ID
     * @param token - LTPA authentication token
     * @returns Job output content
     */
    getJobOutput(jobName: string, jobId: string, token: string): Promise<string>;
    /**
     * List datasets matching a pattern
     * @param pattern - Dataset name pattern (e.g., "Z12345.*")
     * @param token - LTPA authentication token
     * @returns Array of dataset information
     */
    listDatasets(pattern: string, token: string): Promise<DatasetInfo[]>;
    /**
     * Read dataset content
     * @param datasetName - Dataset name
     * @param token - LTPA authentication token
     * @returns Dataset content
     */
    readDataset(datasetName: string, token: string): Promise<string>;
    /**
     * Get spool files for a job
     * @param jobName - Job name
     * @param jobId - Job ID
     * @param token - LTPA authentication token
     * @returns List of spool files
     */
    getSpoolFiles(jobName: string, jobId: string, token: string): Promise<any[]>;
    /**
     * Get content of a specific spool file
     * @param jobName - Job name
     * @param jobId - Job ID
     * @param fileId - Spool file ID
     * @param token - LTPA authentication token
     * @returns Spool file content
     */
    getSpoolContent(jobName: string, jobId: string, fileId: number, token: string): Promise<string>;
    /**
     * Get dataset member content
     * Supports format: DATASET.NAME(MEMBER) or DATASET.NAME
     * @param datasetName - Dataset name with optional member
     * @param token - LTPA authentication token
     * @returns Dataset/member content
     */
    getDatasetMember(datasetName: string, token: string): Promise<string>;
    /**
     * List members of a partitioned dataset (PDS)
     * @param datasetName - Dataset name (without member)
     * @param token - LTPA authentication token
     * @returns Array of member names
     */
    listDatasetMembers(datasetName: string, token: string): Promise<string[]>;
    /**
     * Handle authentication errors
     */
    private handleAuthError;
    /**
     * Create a standardized error
     */
    private createError;
}
export declare const zosmfClient: ZOSMFClient;
//# sourceMappingURL=client.d.ts.map