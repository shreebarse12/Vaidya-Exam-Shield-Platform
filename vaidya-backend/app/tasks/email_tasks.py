"""
Email Tasks — runs via Celery so emails never block the API response.

All user-facing emails:
- OTP verification
- Welcome email after registration
- Password reset
- Exam results
- Invoice/payment confirmation
- Subscription expiry reminder
"""

from app.tasks.proctoring_tasks import celery_app


@celery_app.task(name="app.tasks.email_tasks.send_otp_email")
def send_otp_email(to_email: str, otp: str, purpose: str = "verification"):
    """
    Send OTP via AWS SES.
    purpose: "verification" | "password_reset"
    """
    subject_map = {
        "verification": "Verify your Vaidya Exam-Shield account",
        "password_reset": "Reset your Vaidya Exam-Shield password",
    }
    subject = subject_map.get(purpose, "Your OTP")

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2 style="color: #1a73e8;">Vaidya Exam-Shield</h2>
        <p>Your one-time password (OTP) is:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px;
                    color: #1a73e8; padding: 20px; text-align: center;
                    background: #f0f4ff; border-radius: 8px;">
            {otp}
        </div>
        <p style="color: #666; font-size: 13px;">
            This OTP expires in 10 minutes. Do not share it with anyone.
        </p>
    </div>
    """
    _send_via_ses(to_email, subject, body_html)


@celery_app.task(name="app.tasks.email_tasks.send_welcome_email")
def send_welcome_email(to_email: str, full_name: str, institute_name: str = ""):
    subject = "Welcome to Vaidya Exam-Shield!"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2 style="color: #1a73e8;">Welcome, {full_name}!</h2>
        {"<p>Your institute <strong>" + institute_name + "</strong> has been approved.</p>" if institute_name else ""}
        <p>Your account is ready. Log in at
           <a href="https://app.vaidya.in">app.vaidya.in</a>
        </p>
        <p style="color: #666; font-size: 13px;">
            Default password: <strong>Welcome@123</strong><br>
            Please change it after your first login.
        </p>
    </div>
    """
    _send_via_ses(to_email, subject, body_html)


@celery_app.task(name="app.tasks.email_tasks.send_exam_result_email")
def send_exam_result_email(
    to_email: str,
    full_name: str,
    exam_name: str,
    score: float,
    max_score: float,
    percentage: float,
    rank: int,
):
    subject = f"Your result: {exam_name}"
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2 style="color: #1a73e8;">Exam Result</h2>
        <p>Hi {full_name}, here's your result for <strong>{exam_name}</strong>:</p>
        <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f0f4ff;">
                <td style="padding: 10px; font-weight: bold;">Score</td>
                <td style="padding: 10px;">{score} / {max_score}</td>
            </tr>
            <tr>
                <td style="padding: 10px; font-weight: bold;">Percentage</td>
                <td style="padding: 10px;">{percentage:.1f}%</td>
            </tr>
            <tr style="background: #f0f4ff;">
                <td style="padding: 10px; font-weight: bold;">Rank</td>
                <td style="padding: 10px;">#{rank}</td>
            </tr>
        </table>
        <p><a href="https://app.vaidya.in/results"
              style="background: #1a73e8; color: white; padding: 10px 20px;
                     border-radius: 6px; text-decoration: none;">
            View Detailed Analysis
        </a></p>
    </div>
    """
    _send_via_ses(to_email, subject, body_html)


@celery_app.task(name="app.tasks.email_tasks.send_invoice_email")
def send_invoice_email(to_email: str, invoice_number: str, amount: str, pdf_url: str = None):
    subject = f"Invoice {invoice_number} — Vaidya Exam-Shield"
    pdf_link = f'<p><a href="{pdf_url}">Download Invoice PDF</a></p>' if pdf_url else ""
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2 style="color: #1a73e8;">Payment Confirmed</h2>
        <p>Invoice <strong>{invoice_number}</strong></p>
        <p>Amount paid: <strong>₹{amount}</strong></p>
        {pdf_link}
        <p style="color: #666; font-size: 13px;">
            Thank you for subscribing to Vaidya Exam-Shield.
        </p>
    </div>
    """
    _send_via_ses(to_email, subject, body_html)


# ── Internal sender ────────────────────────────────────────────────────────────
def _send_via_ses(to_email: str, subject: str, body_html: str):
    """
    Send an email via AWS Simple Email Service.
    In development (DEBUG=True) just prints to console.
    """
    from app.config import settings

    if settings.DEBUG:
        print(f"\n[EMAIL] To: {to_email}")
        print(f"[EMAIL] Subject: {subject}")
        print(f"[EMAIL] Body: {body_html[:200]}...\n")
        return

    try:
        import boto3
        ses = boto3.client(
            "ses",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        ses.send_email(
            Source=settings.AWS_SES_SENDER_EMAIL,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Html": {"Data": body_html, "Charset": "UTF-8"}},
            },
        )
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {to_email}: {e}")