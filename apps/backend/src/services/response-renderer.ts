export type TelegramRenderedResponse = {
  text: string;
  reply_markup: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
};

export type SlackRenderedResponse = {
  text: string;
  blocks: Array<Record<string, unknown>>;
};

export type WhatsAppRenderedResponse = {
  text: string;
  quick_replies: Array<{
    type: "reply";
    reply: {
      id: string;
      title: string;
    };
  }>;
};

function safePreview(text: string): string {
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

export function renderTelegramResponse(aiText: string): TelegramRenderedResponse {
  return {
    text: aiText,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Regenerate", callback_data: "regenerate_reply" },
          { text: "Need Human", callback_data: "handoff_human" }
        ],
        [{ text: "Main Menu", callback_data: "main_menu" }]
      ]
    }
  };
}

export function renderSlackResponse(aiText: string): SlackRenderedResponse {
  return {
    text: aiText,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Omnichannel AI*`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: aiText
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Preview: ${safePreview(aiText)}`
          }
        ]
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Regenerate" },
            action_id: "regenerate_reply"
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Human Support" },
            action_id: "handoff_human"
          }
        ]
      }
    ]
  };
}

export function renderWhatsAppMockResponse(aiText: string): WhatsAppRenderedResponse {
  return {
    text: aiText,
    quick_replies: [
      {
        type: "reply",
        reply: {
          id: "regenerate_reply",
          title: "Regenerate"
        }
      },
      {
        type: "reply",
        reply: {
          id: "handoff_human",
          title: "Need Human"
        }
      },
      {
        type: "reply",
        reply: {
          id: "main_menu",
          title: "Main Menu"
        }
      }
    ]
  };
}
