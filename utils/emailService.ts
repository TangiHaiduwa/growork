interface EmailData {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  path?: string;
}

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

const getApplicantData = (applicationData: any) => {
  const snapshotApplicant = applicationData?.application_snapshot?.applicant || {};
  const liveApplicant = applicationData?.profiles || {};

  const fullName =
    applicationData?.applicant_name_snapshot ||
    snapshotApplicant.full_name ||
    [liveApplicant.name, liveApplicant.surname].filter(Boolean).join(" ").trim() ||
    liveApplicant.username ||
    "Applicant";

  return {
    fullName,
    username: liveApplicant.username || snapshotApplicant.username || "applicant",
    phone: applicationData?.applicant_phone_snapshot || snapshotApplicant.phone || liveApplicant.phone || null,
    profession: liveApplicant.profession || null,
    experienceYears: liveApplicant.experience_years || null,
    education: liveApplicant.education || null,
    location: liveApplicant.location || null,
    website: liveApplicant.website || null,
    skills: liveApplicant.skills || null,
    bio: liveApplicant.bio || null,
  };
};

const getJobData = (applicationData: any) => {
  const snapshotJob = applicationData?.application_snapshot?.job || {};
  const liveJob = applicationData?.posts || {};

  return {
    title:
      applicationData?.job_title_snapshot ||
      snapshotJob.title ||
      liveJob.title ||
      "Job opportunity",
    company:
      applicationData?.companies?.name ||
      liveJob?.criteria?.company ||
      liveJob?.criteria?.companyName ||
      "Not specified",
    type: liveJob.type || liveJob?.criteria?.jobType || "Not specified",
    industry: liveJob.industry || null,
    content: liveJob.content || null,
    criteria: liveJob.criteria || null,
    createdAt: liveJob.created_at || null,
  };
};

const buildAppliedDate = (applicationData: any) =>
  applicationData?.appliedDate ||
  (applicationData?.created_at
    ? new Date(applicationData.created_at).toLocaleDateString()
    : new Date().toLocaleDateString());

const buildApplicantFileStem = (applicationData: any) => {
  const applicant = getApplicantData(applicationData);
  return applicant.username || applicant.fullName.replace(/\s+/g, "_").toLowerCase();
};

export const generateApplicationEmailHTML = (applicationData: any) => {
  const applicant = getApplicantData(applicationData);
  const job = getJobData(applicationData);
  const status = applicationData?.status || "pending";
  const appliedDate = buildAppliedDate(applicationData);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Job Application Update</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .status { padding: 10px 20px; border-radius: 5px; font-weight: bold; margin: 10px 0; }
        .status.pending { background: #fff3cd; color: #856404; }
        .status.reviewed { background: #d1ecf1; color: #0c5460; }
        .status.accepted { background: #d4edda; color: #155724; }
        .status.rejected { background: #f8d7da; color: #721c24; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Job Application Update</h2>
          <p>Hello ${applicant.fullName},</p>
        </div>
        
        <div class="details">
          <h3>Application Details</h3>
          <p><strong>Job Title:</strong> ${job.title}</p>
          <p><strong>Company:</strong> ${job.company}</p>
          <p><strong>Applied Date:</strong> ${appliedDate}</p>
          <p><strong>Current Status:</strong> 
            <span class="status ${String(status).toLowerCase()}">${status}</span>
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated message from Growork. Please do not reply to this email.</p>
          <p>If you have any questions, please contact the company directly.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const prepareApplicationAttachments = async (
  applicationData: any,
  supabase: any
) => {
  const attachments: EmailAttachment[] = [];

  try {
    const applicantStem = buildApplicantFileStem(applicationData);
    const documents = applicationData?.documents || [];

    if (documents.length > 0) {
      for (const doc of documents) {
        if (!doc?.file_url) {
          continue;
        }

        try {
          const response = await fetch(doc.file_url);
          if (!response.ok) {
            continue;
          }

          const docBuffer = await response.arrayBuffer();
          attachments.push({
            filename: doc.name || `${doc.type || "document"}_${applicantStem}.pdf`,
            content: Buffer.from(docBuffer),
            contentType: "application/pdf",
          });
        } catch (error) {
          console.error(`Error fetching document ${doc?.name || doc?.id}:`, error);
        }
      }
    }

    if (applicationData?.resume_url && attachments.length === 0) {
      const resumeResponse = await fetch(applicationData.resume_url);
      if (resumeResponse.ok) {
        const resumeBuffer = await resumeResponse.arrayBuffer();
        attachments.push({
          filename: `resume_${applicantStem}.pdf`,
          content: Buffer.from(resumeBuffer),
          contentType: "application/pdf",
        });
      }
    }

    if (applicationData?.cover_letter && attachments.length === 0) {
      attachments.push({
        filename: `cover_letter_${applicantStem}.txt`,
        content: applicationData.cover_letter,
        contentType: "text/plain",
      });
    }
  } catch (error) {
    console.error("Error preparing attachments:", error);
  }

  return attachments;
};

export const generateStatusUpdateEmail = (
  applicationData: any,
  newStatus: string
) => {
  const applicant = getApplicantData(applicationData);
  const job = getJobData(applicationData);
  const companies = applicationData?.companies || null;
  const documents = applicationData?.documents || [];
  const appliedDate = buildAppliedDate(applicationData);
  const hasDocuments = documents.length > 0;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Job Application - ${job.title}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .applicant-info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .job-info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .company-info { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .documents-info { background: #fff8dc; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .highlight { background: #d4edda; color: #155724; padding: 10px; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Job Application Received</h2>
          <p>Dear HR Team,</p>
          <p>A new application has been submitted for the <strong>${job.title}</strong> position.</p>
        </div>
        
        <div class="highlight">
          <strong>Application Status: ${newStatus.toUpperCase()}</strong>
        </div>
        
        <div class="applicant-info">
          <h3>Applicant Information</h3>
          <p><strong>Name:</strong> ${applicant.fullName}</p>
          <p><strong>Username:</strong> ${applicant.username}</p>
          <p><strong>Applied Date:</strong> ${appliedDate}</p>
          ${applicant.profession ? `<p><strong>Profession:</strong> ${applicant.profession}</p>` : ""}
          ${applicant.experienceYears ? `<p><strong>Experience:</strong> ${applicant.experienceYears} years</p>` : ""}
          ${applicant.education ? `<p><strong>Education:</strong> ${applicant.education}</p>` : ""}
          ${applicant.location ? `<p><strong>Location:</strong> ${applicant.location}</p>` : ""}
          ${applicant.phone ? `<p><strong>Phone:</strong> ${applicant.phone}</p>` : ""}
          ${applicant.website ? `<p><strong>Website:</strong> <a href="${applicant.website}">${applicant.website}</a></p>` : ""}
          ${applicant.skills && applicant.skills.length > 0 ? `<p><strong>Skills:</strong> ${applicant.skills.join(", ")}</p>` : ""}
          ${applicant.bio ? `<p><strong>Bio:</strong> ${applicant.bio}</p>` : ""}
        </div>
        
        <div class="job-info">
          <h3>Job Details</h3>
          <p><strong>Position:</strong> ${job.title}</p>
          <p><strong>Type:</strong> ${job.type}</p>
          <p><strong>Industry:</strong> ${job.industry || "Not specified"}</p>
          ${job.content ? `<p><strong>Job Description:</strong> ${job.content}</p>` : ""}
          ${
            job.criteria
              ? `
            <p><strong>Requirements:</strong></p>
            <ul>
              ${Object.entries(job.criteria)
                .filter(([key]) => !["companyId", "company_id"].includes(key))
                .map(([key, value]) => {
                  const label =
                    key === "salary"
                      ? "Salary"
                      : key === "company"
                        ? "Company"
                        : key === "jobType"
                          ? "Job Type"
                          : key === "location"
                            ? "Location"
                            : key.charAt(0).toUpperCase() + key.slice(1);
                  return `<li><strong>${label}:</strong> ${value}</li>`;
                })
                .join("")}
            </ul>
          `
              : ""
          }
          <p><strong>Posted:</strong> ${job.createdAt ? new Date(job.createdAt).toLocaleDateString() : "Not specified"}</p>
        </div>

        ${
          companies
            ? `
        <div class="company-info">
          <h3>Company Information</h3>
          <p><strong>Company Name:</strong> ${companies.name}</p>
          ${companies.description ? `<p><strong>Description:</strong> ${companies.description}</p>` : ""}
          ${companies.industry ? `<p><strong>Industry:</strong> ${companies.industry}</p>` : ""}
          ${companies.size ? `<p><strong>Company Size:</strong> ${companies.size}</p>` : ""}
          ${companies.location ? `<p><strong>Location:</strong> ${companies.location}</p>` : ""}
          ${companies.website ? `<p><strong>Website:</strong> <a href="${companies.website}">${companies.website}</a></p>` : ""}
          ${companies.founded_year ? `<p><strong>Founded:</strong> ${companies.founded_year}</p>` : ""}
        </div>
        `
            : ""
        }

        ${
          hasDocuments
            ? `
        <div class="documents-info">
          <h3>Documents Submitted</h3>
          <p>The applicant has submitted the following documents. Click the links to download:</p>
          <ul>
            ${documents
              .map(
                (doc: any) => `
              <li>
                <strong>${doc.name || doc.type}:</strong> 
                <a href="${doc.file_url}" target="_blank" style="color: #007bff; text-decoration: underline;">
                  Download ${doc.name || doc.type}
                </a>
              </li>
            `
              )
              .join("")}
          </ul>
        </div>
        `
            : ""
        }

        ${
          applicationData?.resume_url
            ? `
        <div class="documents-info">
          <h3>Resume</h3>
          <p><a href="${applicationData.resume_url}" target="_blank" style="color: #007bff; text-decoration: underline;">
            Download Resume
          </a></p>
        </div>
        `
            : ""
        }

        ${
          applicationData?.cover_letter
            ? `
        <div class="documents-info">
          <h3>Cover Letter</h3>
          ${
            String(applicationData.cover_letter).startsWith("http")
              ? `<p><a href="${applicationData.cover_letter}" target="_blank" style="color: #007bff; text-decoration: underline;">
              Download Cover Letter
            </a></p>`
              : `<p><strong>Cover Letter Content:</strong></p>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0;">
              ${applicationData.cover_letter}
            </div>`
          }
        </div>
        `
            : ""
        }
        
        <div class="footer">
          <p>This is an automated notification from Growork Application System.</p>
          <p>Please review the application and contact the applicant directly if needed.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const sendEmailViaEdgeFunction = async ({
  to,
  subject,
  html,
}: SendEmailParams) => {
  const functionBaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

  if (!functionBaseUrl || !anonKey) {
    throw new Error("Missing Supabase email function configuration");
  }

  const response = await fetch(`${functionBaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      to,
      subject,
      html,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Email request failed: ${response.status}`);
  }

  return payload;
};

export type { EmailAttachment, EmailData };
