import { BUSINESS_INFO } from "@/lib/constants";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  "Bhagyalakshmi Future Gold <noreply@bhagylakshmi-future-gold-commerce.com>";

const ADDRESS_FOOTER = `
  <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e5e5;" />
  <div style="margin-top: 16px; color: #71717a; font-size: 12px; text-align: center;">
    <p style="margin: 0;">Bhagyalakshmi Future Gold</p>
    <p style="margin: 4px 0 0;">${BUSINESS_INFO.address.city}, ${BUSINESS_INFO.address.district} Dist., ${BUSINESS_INFO.address.state}</p>
    ${BUSINESS_INFO.phone ? `<p style="margin: 4px 0 0;">Phone: ${BUSINESS_INFO.phone}</p>` : ""}
  </div>
`;

export async function sendWelcomeEmail(email: string, name: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to Bhagyalakshmi Future Gold!",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #18181b;">Welcome, ${name}!</h1>
          <p>Thank you for joining Bhagyalakshmi Future Gold. We're thrilled to have you.</p>
          <p>Discover our exquisite collection of fashion jewellery — from elegant necklaces to stunning rings.</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/products"
             style="display: inline-block; padding: 12px 24px; background: #18181b; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            Start Shopping
          </a>
          <p style="margin-top: 24px; color: #71717a; font-size: 14px;">
            — The Bhagyalakshmi Future Gold Team
          </p>
          ${ADDRESS_FOOTER}
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }
}

export async function sendOrderConfirmationEmail(
  email: string,
  orderNumber: string,
  total: number,
  items: Array<{ name: string; quantity: number; price: number }>,
) {
  const itemsHtml = items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; text-align: right;">₹${item.price}</td>
        </tr>`,
    )
    .join("");

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Order Confirmed - ${orderNumber}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #18181b;">Order Confirmed!</h1>
          <p>Your order <strong>${orderNumber}</strong> has been confirmed.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left;">Item</th>
                <th style="padding: 8px; text-align: center;">Qty</th>
                <th style="padding: 8px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <p style="margin-top: 16px; font-size: 18px;"><strong>Total: ₹${total}</strong></p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/account/orders"
             style="display: inline-block; padding: 12px 24px; background: #18181b; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            Track Order
          </a>
          <p style="margin-top: 24px; color: #71717a; font-size: 14px;">
            Thank you for shopping with Bhagyalakshmi Future Gold!
          </p>
          ${ADDRESS_FOOTER}
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send order confirmation email:", error);
  }
}

export async function sendShippingNotificationEmail(
  email: string,
  orderNumber: string,
) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Your Order ${orderNumber} Has Been Shipped!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #18181b;">Your Order is on its way!</h1>
          <p>Great news! Your order <strong>${orderNumber}</strong> has been shipped.</p>
          <p>You can track your order status in your account.</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/account/orders"
             style="display: inline-block; padding: 12px 24px; background: #18181b; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            Track Order
          </a>
          <p style="margin-top: 24px; color: #71717a; font-size: 14px;">
            — The Bhagyalakshmi Future Gold Team
          </p>
          ${ADDRESS_FOOTER}
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send shipping notification:", error);
  }
}
