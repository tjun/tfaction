import * as core from "@actions/core";
import * as lib from "lib";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

function exportSecret(
  envName: string,
  projectID: string,
  secretID: string,
  secretValue: string,
) {
  core.info(
    `export the secret as the environment variable: project_id=${projectID} secret_id=${secretID} env_name=${envName}`,
  );

  core.setSecret(secretValue);
  core.exportVariable(envName, secretValue);
}

async function exportSecrets(
  client: SecretManagerServiceClient,
  secrets: Array<lib.GCPSecretManagerSecret>,
) {
  for (let i = 0; i < secrets.length; i++) {
    const secret = secrets[i];
    if (!secret.project_id) {
      throw new Error("project_id is required");
    }
    if (!secret.secret_id) {
      throw new Error("secret_id is required");
    }
    if (!secret.env.env_name) {
      throw new Error(
        `env_name is required: project_id= ${secret.project_id} secret_id=${secret.secret_id}`,
      );
    }

    const version = secret.version ? secret.version : "latest";
    const name = `projects/${secret.project_id}/secrets/${secret.secret_id}/versions/${version}`;
    const request = {
      name: name,
    };

    const [response] = await client.accessSecretVersion(request);
    if (!response.payload || !response.payload.data) {
      throw new Error(
        `response payload is empty: project_id= ${secret.project_id} secret_id=${secret.secret_id}`,
      );
    }
    let value = response.payload.data.toString();

    exportSecret(
      secret.env.env_name,
      secret.project_id,
      secret.secret_id,
      value,
    );
  }
}

export const run = async (): Promise<void> => {
  const config = lib.getConfig();
  const targetS = lib.getTarget();
  const jobType = lib.getJobType();
  const isApply = lib.getIsApply();
  const targetConfig = lib.getTargetGroup(config.target_groups, targetS);
  const jobConfig = lib.getJobConfig(targetConfig, isApply, jobType);
  let gcpClient = null;
  if (targetConfig.gcp_secret_manager) {
    gcpClient = new SecretManagerServiceClient();
    await exportSecrets(gcpClient, targetConfig.gcp_secret_manager);
  }

  if (jobConfig && jobConfig.gcp_secret_manager) {
    if (!gcpClient) {
      gcpClient = new SecretManagerServiceClient();
    }
    await exportSecrets(gcpClient, jobConfig.gcp_secret_manager);
  }
};
