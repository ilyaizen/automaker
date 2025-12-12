/**
 * Feature Loader - Handles loading and managing features from individual feature folders
 * Each feature is stored in .automaker/features/{featureId}/feature.json
 */

import path from "path";
import fs from "fs/promises";

export interface Feature {
  id: string;
  category: string;
  description: string;
  steps?: string[];
  passes?: boolean;
  priority?: number;
  imagePaths?: Array<string | { path: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export class FeatureLoader {
  /**
   * Get the features directory path
   */
  getFeaturesDir(projectPath: string): string {
    return path.join(projectPath, ".automaker", "features");
  }

  /**
   * Get the path to a specific feature folder
   */
  getFeatureDir(projectPath: string, featureId: string): string {
    return path.join(this.getFeaturesDir(projectPath), featureId);
  }

  /**
   * Get the path to a feature's feature.json file
   */
  getFeatureJsonPath(projectPath: string, featureId: string): string {
    return path.join(this.getFeatureDir(projectPath, featureId), "feature.json");
  }

  /**
   * Get the path to a feature's agent-output.md file
   */
  getAgentOutputPath(projectPath: string, featureId: string): string {
    return path.join(this.getFeatureDir(projectPath, featureId), "agent-output.md");
  }

  /**
   * Generate a new feature ID
   */
  generateFeatureId(): string {
    return `feature-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get all features for a project
   */
  async getAll(projectPath: string): Promise<Feature[]> {
    try {
      const featuresDir = this.getFeaturesDir(projectPath);

      // Check if features directory exists
      try {
        await fs.access(featuresDir);
      } catch {
        return [];
      }

      // Read all feature directories
      const entries = await fs.readdir(featuresDir, { withFileTypes: true });
      const featureDirs = entries.filter((entry) => entry.isDirectory());

      // Load each feature
      const features: Feature[] = [];
      for (const dir of featureDirs) {
        const featureId = dir.name;
        const featureJsonPath = this.getFeatureJsonPath(projectPath, featureId);

        try {
          const content = await fs.readFile(featureJsonPath, "utf-8");
          const feature = JSON.parse(content);

          if (!feature.id) {
            console.warn(
              `[FeatureLoader] Feature ${featureId} missing required 'id' field, skipping`
            );
            continue;
          }

          features.push(feature);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            continue;
          } else if (error instanceof SyntaxError) {
            console.warn(
              `[FeatureLoader] Failed to parse feature.json for ${featureId}: ${error.message}`
            );
          } else {
            console.error(
              `[FeatureLoader] Failed to load feature ${featureId}:`,
              (error as Error).message
            );
          }
        }
      }

      // Sort by creation order (feature IDs contain timestamp)
      features.sort((a, b) => {
        const aTime = a.id ? parseInt(a.id.split("-")[1] || "0") : 0;
        const bTime = b.id ? parseInt(b.id.split("-")[1] || "0") : 0;
        return aTime - bTime;
      });

      return features;
    } catch (error) {
      console.error("[FeatureLoader] Failed to get all features:", error);
      return [];
    }
  }

  /**
   * Get a single feature by ID
   */
  async get(projectPath: string, featureId: string): Promise<Feature | null> {
    try {
      const featureJsonPath = this.getFeatureJsonPath(projectPath, featureId);
      const content = await fs.readFile(featureJsonPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      console.error(`[FeatureLoader] Failed to get feature ${featureId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new feature
   */
  async create(projectPath: string, featureData: Partial<Feature>): Promise<Feature> {
    const featureId = featureData.id || this.generateFeatureId();
    const featureDir = this.getFeatureDir(projectPath, featureId);
    const featureJsonPath = this.getFeatureJsonPath(projectPath, featureId);

    // Ensure features directory exists
    const featuresDir = this.getFeaturesDir(projectPath);
    await fs.mkdir(featuresDir, { recursive: true });

    // Create feature directory
    await fs.mkdir(featureDir, { recursive: true });

    // Ensure feature has required fields
    const feature: Feature = {
      category: featureData.category || "Uncategorized",
      description: featureData.description || "",
      ...featureData,
      id: featureId,
    };

    // Write feature.json
    await fs.writeFile(featureJsonPath, JSON.stringify(feature, null, 2), "utf-8");

    console.log(`[FeatureLoader] Created feature ${featureId}`);
    return feature;
  }

  /**
   * Update a feature (partial updates supported)
   */
  async update(
    projectPath: string,
    featureId: string,
    updates: Partial<Feature>
  ): Promise<Feature> {
    const feature = await this.get(projectPath, featureId);
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }

    // Merge updates
    const updatedFeature: Feature = { ...feature, ...updates };

    // Write back to file
    const featureJsonPath = this.getFeatureJsonPath(projectPath, featureId);
    await fs.writeFile(
      featureJsonPath,
      JSON.stringify(updatedFeature, null, 2),
      "utf-8"
    );

    console.log(`[FeatureLoader] Updated feature ${featureId}`);
    return updatedFeature;
  }

  /**
   * Delete a feature
   */
  async delete(projectPath: string, featureId: string): Promise<boolean> {
    try {
      const featureDir = this.getFeatureDir(projectPath, featureId);
      await fs.rm(featureDir, { recursive: true, force: true });
      console.log(`[FeatureLoader] Deleted feature ${featureId}`);
      return true;
    } catch (error) {
      console.error(`[FeatureLoader] Failed to delete feature ${featureId}:`, error);
      return false;
    }
  }

  /**
   * Get agent output for a feature
   */
  async getAgentOutput(
    projectPath: string,
    featureId: string
  ): Promise<string | null> {
    try {
      const agentOutputPath = this.getAgentOutputPath(projectPath, featureId);
      const content = await fs.readFile(agentOutputPath, "utf-8");
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      console.error(
        `[FeatureLoader] Failed to get agent output for ${featureId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Save agent output for a feature
   */
  async saveAgentOutput(
    projectPath: string,
    featureId: string,
    content: string
  ): Promise<void> {
    const featureDir = this.getFeatureDir(projectPath, featureId);
    await fs.mkdir(featureDir, { recursive: true });

    const agentOutputPath = this.getAgentOutputPath(projectPath, featureId);
    await fs.writeFile(agentOutputPath, content, "utf-8");
  }

  /**
   * Delete agent output for a feature
   */
  async deleteAgentOutput(projectPath: string, featureId: string): Promise<void> {
    try {
      const agentOutputPath = this.getAgentOutputPath(projectPath, featureId);
      await fs.unlink(agentOutputPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
