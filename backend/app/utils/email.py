"""
Email utilities for the application.

Handles sending various types of emails including verification emails,
notifications, and admin communications.
"""

import asyncio
from typing import Dict, List, Optional
from dataclasses import dataclass

from app.utils.logging import get_logger
from app.core.config import settings

logger = get_logger(__name__)


@dataclass
class EmailContent:
    """Email content structure."""
    subject: str
    html_body: str
    text_body: Optional[str] = None
    attachments: Optional[List[Dict]] = None


class EmailService:
    """Email service for sending various types of emails."""

    def __init__(self):
        self.sender_email = getattr(settings, 'FROM_EMAIL', 'noreply@cofoundermatching.com')
        self.sender_name = getattr(settings, 'FROM_NAME', 'Cofounder Matching')

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        attachments: Optional[List[Dict]] = None
    ) -> bool:
        """
        Send an email. In production, this would integrate with SendGrid, SES, etc.
        For now, we'll simulate sending and log the email content.
        """
        try:
            email_content = {
                'from': f"{self.sender_name} <{self.sender_email}>",
                'to': to_email,
                'subject': subject,
                'html_body': html_body,
                'text_body': text_body or self._html_to_text(html_body),
                'attachments': attachments or []
            }

            # In production, replace this with actual email sending
            logger.info(
                f"Email sent: {subject} to {to_email}",
                extra={
                    'email_to': to_email,
                    'email_subject': subject,
                    'email_content': email_content
                }
            )

            # Simulate async email sending
            await asyncio.sleep(0.1)
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    def _html_to_text(self, html_body: str) -> str:
        """Convert HTML to plain text (simplified implementation)."""
        import re

        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', html_body)

        # Convert HTML entities
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&quot;', '"')

        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()

        return text

    async def send_verification_email(
        self,
        to_email: str,
        user_name: str,
        verification_url: str
    ) -> bool:
        """Send email verification email."""
        subject = "Verify your email address - Cofounder Matching"

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c5aa0;">Verify Your Email Address</h2>

                <p>Hi {user_name},</p>

                <p>Welcome to Cofounder Matching! To complete your registration and start connecting with potential co-founders, please verify your email address by clicking the button below.</p>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}"
                       style="background-color: #2c5aa0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Verify Email Address
                    </a>
                </div>

                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666; font-size: 14px;">{verification_url}</p>

                <p>This verification link will expire in 24 hours.</p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                <p style="font-size: 14px; color: #666;">
                    If you didn't create an account with Cofounder Matching, please ignore this email.
                </p>

                <p style="font-size: 14px; color: #666;">
                    Best regards,<br>
                    The Cofounder Matching Team
                </p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(to_email, subject, html_body)

    async def send_verification_success_email(
        self,
        to_email: str,
        user_name: str
    ) -> bool:
        """Send email verification success notification."""
        subject = "Email verified successfully - Cofounder Matching"

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #28a745;">Email Verified Successfully!</h2>

                <p>Hi {user_name},</p>

                <p>Great news! Your email address has been successfully verified. You can now access all features of the Cofounder Matching platform.</p>

                <p>Next steps:</p>
                <ul>
                    <li>Complete your profile to improve your matching potential</li>
                    <li>Add your LinkedIn and GitHub profiles for verification</li>
                    <li>Start browsing potential co-founders</li>
                    <li>Set your co-founder preferences</li>
                </ul>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{settings.FRONTEND_URL}/profile"
                       style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Complete Your Profile
                    </a>
                </div>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                <p style="font-size: 14px; color: #666;">
                    Best regards,<br>
                    The Cofounder Matching Team
                </p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(to_email, subject, html_body)

    async def send_admin_verification_request_email(
        self,
        admin_email: str,
        user_name: str,
        user_email: str,
        verification_type: str,
        admin_review_url: str
    ) -> bool:
        """Send admin notification for manual verification request."""
        subject = f"Manual Verification Request - {user_name}"

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #dc3545;">Manual Verification Required</h2>

                <p>A user has requested manual verification:</p>

                <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">User:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{user_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{user_email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Verification Type:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{verification_type}</td>
                    </tr>
                </table>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{admin_review_url}"
                       style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Review Verification Request
                    </a>
                </div>

                <p style="font-size: 14px; color: #666;">
                    Please review this verification request within 7 days.
                </p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(admin_email, subject, html_body)

    async def send_admin_action_notification(
        self,
        user_email: str,
        user_name: str,
        action: str,
        admin_message: str = None
    ) -> bool:
        """Send notification to user about admin action taken on their account."""
        action_titles = {
            "approve": "Account Approved",
            "reject": "Account Review Update",
            "ban": "Account Suspended",
            "suspend": "Account Temporarily Suspended"
        }

        action_colors = {
            "approve": "#28a745",
            "reject": "#ffc107",
            "ban": "#dc3545",
            "suspend": "#fd7e14"
        }

        subject = f"{action_titles.get(action, 'Account Update')} - Cofounder Matching"
        color = action_colors.get(action, "#6c757d")

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: {color};">{action_titles.get(action, 'Account Update')}</h2>

                <p>Hi {user_name},</p>

                <p>We're writing to inform you about an update to your Cofounder Matching account.</p>

                <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid {color}; margin: 20px 0;">
                    <p><strong>Action Taken:</strong> {action.replace('_', ' ').title()}</p>
                    {f"<p><strong>Details:</strong> {admin_message}</p>" if admin_message else ""}
                </div>

                {"<p>Your account has been approved and you can now use all platform features.</p>" if action == "approve" else ""}
                {"<p>Please review our community guidelines and ensure your profile meets our requirements.</p>" if action == "reject" else ""}
                {"<p>Your account has been suspended due to policy violations. If you believe this is an error, please contact support.</p>" if action == "ban" else ""}

                <p>If you have any questions about this action, please don't hesitate to contact our support team.</p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                <p style="font-size: 14px; color: #666;">
                    Best regards,<br>
                    The Cofounder Matching Team
                </p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(user_email, subject, html_body)


# Global email service instance
email_service = EmailService()


# Convenience functions
async def send_verification_email(to_email: str, user_name: str, verification_url: str) -> bool:
    """Send verification email."""
    return await email_service.send_verification_email(to_email, user_name, verification_url)


async def send_verification_success_email(to_email: str, user_name: str) -> bool:
    """Send verification success email."""
    return await email_service.send_verification_success_email(to_email, user_name)


async def send_admin_verification_request_email(
    admin_email: str,
    user_name: str,
    user_email: str,
    verification_type: str,
    admin_review_url: str
) -> bool:
    """Send admin verification request email."""
    return await email_service.send_admin_verification_request_email(
        admin_email, user_name, user_email, verification_type, admin_review_url
    )


async def send_admin_action_notification(
    user_email: str,
    user_name: str,
    action: str,
    admin_message: str = None
) -> bool:
    """Send admin action notification email."""
    return await email_service.send_admin_action_notification(
        user_email, user_name, action, admin_message
    )