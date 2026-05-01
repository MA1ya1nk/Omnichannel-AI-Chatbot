import { prisma } from "../prisma.js";

export async function resolveProfileId(input: {
  channel: string;
  externalUserId?: string;
  canonicalIdentityKey?: string;
}): Promise<string | null> {
  if (input.canonicalIdentityKey) {
    const byCanonical = await prisma.userProfile.findUnique({
      where: { canonicalKey: input.canonicalIdentityKey }
    });
    if (byCanonical) {
      if (input.externalUserId) {
        await prisma.channelIdentity.upsert({
          where: {
            channel_externalUserId: {
              channel: input.channel,
              externalUserId: input.externalUserId
            }
          },
          update: {
            profileId: byCanonical.id
          },
          create: {
            channel: input.channel,
            externalUserId: input.externalUserId,
            profileId: byCanonical.id
          }
        });
      }
      return byCanonical.id;
    }
  }

  if (input.externalUserId) {
    const existingIdentity = await prisma.channelIdentity.findUnique({
      where: {
        channel_externalUserId: {
          channel: input.channel,
          externalUserId: input.externalUserId
        }
      }
    });
    if (existingIdentity) {
      return existingIdentity.profileId;
    }
  }

  const profile = await prisma.userProfile.create({
    data: {
      canonicalKey: input.canonicalIdentityKey
    }
  });

  if (input.externalUserId) {
    await prisma.channelIdentity.create({
      data: {
        channel: input.channel,
        externalUserId: input.externalUserId,
        profileId: profile.id
      }
    });
  }

  return profile.id;
}

export async function linkUserIdentities(input: {
  canonicalKey: string;
  links: Array<{ channel: string; externalUserId: string }>;
}): Promise<string> {
  const canonicalKey = input.canonicalKey.trim().toLowerCase();
  const profile = await prisma.userProfile.upsert({
    where: { canonicalKey },
    update: {},
    create: {
      canonicalKey,
      displayName: canonicalKey
    }
  });

  for (const link of input.links) {
    await prisma.channelIdentity.upsert({
      where: {
        channel_externalUserId: {
          channel: link.channel,
          externalUserId: link.externalUserId
        }
      },
      update: {
        profileId: profile.id
      },
      create: {
        channel: link.channel,
        externalUserId: link.externalUserId,
        profileId: profile.id
      }
    });

    const sessionIdsToBackfill: string[] = [];
    if (link.channel === "slack") {
      sessionIdsToBackfill.push(`slack-user:${link.externalUserId}`);
    } else if (link.channel === "telegram") {
      sessionIdsToBackfill.push(`telegram-user:${link.externalUserId}`);
    }

    await prisma.conversation.updateMany({
      where: {
        channel: link.channel,
        OR: [
          {
            userId: link.externalUserId
          },
          ...(sessionIdsToBackfill.length
            ? [
                {
                  sessionId: {
                    in: sessionIdsToBackfill
                  }
                }
              ]
            : [])
        ]
      },
      data: {
        profileId: profile.id
      }
    });
  }

  return profile.id;
}
