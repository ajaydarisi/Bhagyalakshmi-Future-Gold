import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "Sparkle Commerce <noreply@sparkle-commerce.com>";

export async function sendWelcomeEmail(email: string, name: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to Sparkle Commerce!",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #18181b;">Welcome, ${name}!</h1>
          <p>Thank you for joining Sparkle Commerce. We're thrilled to have you.</p>
          <p>Discover our exquisite collection of fashion jewelry — from elegant necklaces to stunning rings.</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/products"
             style="display: inline-block; padding: 12px 24px; background: #18181b; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            Start Shopping
          </a>
          <p style="margin-top: 24px; color: #71717a; font-size: 14px;">
            — The Sparkle Commerce Team
          </p>
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
  items: Array<{ name: string; quantity: number; price: number }>
) {
  const itemsHtml = items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${item.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; text-align: right;">₹${item.price}</td>
        </tr>`
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
            Thank you for shopping with Sparkle Commerce!
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send order confirmation email:", error);
  }
}

export async function sendShippingNotificationEmail(
  email: string,
  orderNumber: string
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
            — The Sparkle Commerce Team
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send shipping notification:", error);
  }
}
