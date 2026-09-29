import logging
from email.message import EmailMessage

import aiosmtplib

from app.config import get_settings

logger = logging.getLogger(__name__)


async def send_alert_email(
    to_email: str,
    user_name: str,
    symbol: str,
    direction: str,
    threshold: float,
    current_price: float,
) -> bool:
    settings = get_settings()
    subject = f"Price alert: {symbol} crossed ₹{threshold:,.2f}"
    direction_text = "rose above" if direction == "above" else "fell below"
    body = (
        f"Hi {user_name},\n\n"
        f"Your alert for {symbol} has been triggered.\n\n"
        f"Condition: price {direction_text} ₹{threshold:,.2f}\n"
        f"Current price: ₹{current_price:,.2f}\n\n"
        f"— Stock Portfolio Alerts\n"
    )

    if not settings.smtp_enabled or not settings.smtp_user or not settings.smtp_password:
        logger.info(
            "[EMAIL DEMO] To=%s Subject=%s | %s @ ₹%.2f (threshold ₹%.2f %s)",
            to_email,
            subject,
            symbol,
            current_price,
            threshold,
            direction,
        )
        return True

    message = EmailMessage()
    message["From"] = settings.smtp_from or settings.smtp_user
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=True,
        )
        logger.info("Alert email sent to %s for %s", to_email, symbol)
        return True
    except Exception as exc:
        logger.exception("Failed to send email to %s: %s", to_email, exc)
        return False
