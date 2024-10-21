import * as mandrill from "mandrill-api/mandrill";
import { EnvironmentConfig, ConfigGroup } from "../config/EnvironmentConfig";

const mandrill_client = null;

const getClient = () => {
  if (mandrill_client !== null) {
    return mandrill_client;
  } else {
    return new mandrill.Mandrill(
      EnvironmentConfig.getProperty(ConfigGroup.MANDRILL, "MANDRILL_API_KEY")
    );
  }
};

export const sendPasswordResetEmail = async (
  emailAddress: string,
  passwordResetCode: string,
  userName: string
) => {
  const baseUrl = EnvironmentConfig.getProperty(ConfigGroup.MANDRILL, 'EMAIL_BASE_URL') || "https://www.graphiumemr.com/";

  const message = {
    subject: "Graphium Health Password Reset",
    to: [{ email: emailAddress, type: "to" }],
    merge_language: "mailchimp",
    global_merge_vars: [
      {
        name: "RESET_PASS_URL",
        content: `${baseUrl}?resetPasswordKey=${passwordResetCode}&un=${userName}`
      }
    ]
  };

  const template = {
    template_name: "passwordreset",
    template_content: [],
    message: message,
    async: false
  };

  return new Promise((resolve, reject) => {
    getClient().messages.sendTemplate(
      template,
      (result: any) => {
        resolve(result);
      },
      (e: any) => {
        console.error(e);
        reject(e);
      }
    );
  });
};

export const sendInvitationEmail = async ({
  emailAddress,
  inviteKey,
  orgShortName,
  orgName
}: {
  emailAddress: string;
  inviteKey: string;
  orgShortName: string;
  orgName: string;
}) => {
  const baseUrl = EnvironmentConfig.getProperty(ConfigGroup.MANDRILL, 'EMAIL_BASE_URL') || "https://www.graphiumemr.com/";
  const message = {
    subject: "Invitation to Graphium Health",
    to: [{ email: emailAddress, type: "to" }],
    merge_language: "mailchimp",
    global_merge_vars: [
      {
        name: "ORGANIZATION_NAME",
        content: orgName
      },
      {
        name: "INVITE_URL",
        content: `${baseUrl}?org=${orgShortName}&inviteKey=${inviteKey}&email=${emailAddress}`
      }
    ]
  };

  const template = {
    template_name: "orginvite",
    template_content: [],
    message: message,
    async: false
  };

  return new Promise((resolve, reject) => {
    getClient().messages.sendTemplate(
      template,
      (result: any) => {
        resolve(result);
      },
      (e: any) => {
        console.error(e);
        reject(e);
      }
    );
  });
};
