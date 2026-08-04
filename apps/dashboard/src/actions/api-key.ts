"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getProject } from "@/actions/project";
import { generateApiKey } from "@/lib/api-key";
import bcrypt from "bcrypt";

export async function createApiKey(
  projectId: string,
  name: string
) {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  const project = await getProject(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const environment = project.environments.find(
    (env) => env.name === "Production"
  );

  if (!environment) {
    throw new Error("Production environment not found");
  }

  const { key, prefix, keyHash } = await generateApiKey();

  await prisma.apiKey.create({
    data: {
      name,
      prefix,
      keyHash,
      projectId: project.id,
      environmentId: environment.id,
    },
  });

  return key;
}

export async function getApiKeys(projectId: string) {
    const session = await getSession();

    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);

    if (!project) {
        throw new Error("Project not found");
    }

    return prisma.apiKey.findMany({
        where: {
            projectId,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
}

export async function verifyApiKey(apiKey: string) {

    const keys = await prisma.apiKey.findMany({
        include: {
            project: true,
            environment: true,
        },
    });


    for (const key of keys) {

        const valid = await bcrypt.compare(
            apiKey,
            key.keyHash
        );


        if (valid) {
            return key;
        }
    }

    return null;
}