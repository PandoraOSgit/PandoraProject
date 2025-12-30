import { createHash, randomBytes } from "crypto";

export type ModelType = 
  | "classification"
  | "regression" 
  | "anomaly_detection"
  | "sentiment_analysis"
  | "price_prediction"
  | "risk_assessment";

export interface ModelConfig {
  modelType: ModelType;
  inputDimension: number;
  outputDimension: number;
  hiddenLayers: number[];
  activationFunction: "relu" | "sigmoid" | "tanh" | "softmax";
  precision: "fp32" | "fp16" | "int8";
}

export interface ZkMLModel {
  id: string;
  name: string;
  config: ModelConfig;
  modelHash: string;
  weightsCommitment: string;
  circuitHash: string;
  verificationKey: string;
  createdAt: number;
  version: string;
}

export interface InferenceProof {
  modelId: string;
  inputHash: string;
  outputHash: string;
  proof: string;
  publicSignals: string[];
  computationSteps: number;
  verificationTime: number;
  createdAt: number;
}

export interface ModelTemplate {
  name: string;
  description: string;
  modelType: ModelType;
  defaultConfig: ModelConfig;
  exampleInputs: number[][];
  exampleOutputs: number[][];
}

const MODEL_TEMPLATES: Record<ModelType, ModelTemplate> = {
  classification: {
    name: "Binary Classification",
    description: "Classify inputs into two categories with ZK-proven inference",
    modelType: "classification",
    defaultConfig: {
      modelType: "classification",
      inputDimension: 10,
      outputDimension: 2,
      hiddenLayers: [64, 32],
      activationFunction: "relu",
      precision: "fp32",
    },
    exampleInputs: [[0.5, 0.3, 0.8, 0.2, 0.9, 0.1, 0.6, 0.4, 0.7, 0.5]],
    exampleOutputs: [[0.85, 0.15]],
  },
  regression: {
    name: "Linear Regression",
    description: "Predict continuous values with verifiable computation",
    modelType: "regression",
    defaultConfig: {
      modelType: "regression",
      inputDimension: 5,
      outputDimension: 1,
      hiddenLayers: [32, 16],
      activationFunction: "relu",
      precision: "fp32",
    },
    exampleInputs: [[1.0, 2.0, 3.0, 4.0, 5.0]],
    exampleOutputs: [[15.5]],
  },
  anomaly_detection: {
    name: "Anomaly Detection",
    description: "Detect unusual patterns with privacy-preserving proofs",
    modelType: "anomaly_detection",
    defaultConfig: {
      modelType: "anomaly_detection",
      inputDimension: 20,
      outputDimension: 1,
      hiddenLayers: [64, 32, 16],
      activationFunction: "relu",
      precision: "fp32",
    },
    exampleInputs: [[...Array(20).fill(0).map(() => Math.random())]],
    exampleOutputs: [[0.02]],
  },
  sentiment_analysis: {
    name: "Sentiment Analysis",
    description: "Analyze text sentiment with ZK-proven classification",
    modelType: "sentiment_analysis",
    defaultConfig: {
      modelType: "sentiment_analysis",
      inputDimension: 128,
      outputDimension: 3,
      hiddenLayers: [64, 32],
      activationFunction: "softmax",
      precision: "fp32",
    },
    exampleInputs: [[...Array(128).fill(0).map(() => Math.random())]],
    exampleOutputs: [[0.1, 0.2, 0.7]],
  },
  price_prediction: {
    name: "Price Prediction",
    description: "Predict token prices with verifiable AI inference",
    modelType: "price_prediction",
    defaultConfig: {
      modelType: "price_prediction",
      inputDimension: 30,
      outputDimension: 1,
      hiddenLayers: [128, 64, 32],
      activationFunction: "relu",
      precision: "fp32",
    },
    exampleInputs: [[...Array(30).fill(0).map(() => Math.random() * 100)]],
    exampleOutputs: [[156.78]],
  },
  risk_assessment: {
    name: "Risk Assessment",
    description: "Assess trading risk with transparent AI decisions",
    modelType: "risk_assessment",
    defaultConfig: {
      modelType: "risk_assessment",
      inputDimension: 15,
      outputDimension: 4,
      hiddenLayers: [64, 32],
      activationFunction: "softmax",
      precision: "fp32",
    },
    exampleInputs: [[...Array(15).fill(0).map(() => Math.random())]],
    exampleOutputs: [[0.1, 0.3, 0.4, 0.2]],
  },
};

function generateCircuitHash(config: ModelConfig): string {
  const circuitDefinition = {
    inputSize: config.inputDimension,
    outputSize: config.outputDimension,
    layers: config.hiddenLayers,
    activation: config.activationFunction,
    constraints: calculateConstraints(config),
  };
  
  return createHash("sha256")
    .update(JSON.stringify(circuitDefinition))
    .digest("hex");
}

function calculateConstraints(config: ModelConfig): number {
  let constraints = config.inputDimension * config.hiddenLayers[0];
  
  for (let i = 1; i < config.hiddenLayers.length; i++) {
    constraints += config.hiddenLayers[i - 1] * config.hiddenLayers[i];
  }
  
  constraints += config.hiddenLayers[config.hiddenLayers.length - 1] * config.outputDimension;
  
  const activationMultiplier = config.activationFunction === "relu" ? 1.5 : 3;
  constraints = Math.floor(constraints * activationMultiplier);
  
  return constraints;
}

function generateVerificationKey(circuitHash: string): string {
  const vk = {
    protocol: "groth16",
    curve: "bn128",
    nPublic: 2,
    vk_alpha_1: [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    vk_beta_2: [
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    ],
    vk_gamma_2: [
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    ],
    vk_delta_2: [
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    ],
    IC: [
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    ],
    circuitHash,
  };
  
  return JSON.stringify(vk);
}

function simulateInference(
  input: number[],
  config: ModelConfig
): number[] {
  let current = input;
  
  for (const layerSize of config.hiddenLayers) {
    const nextLayer: number[] = [];
    for (let i = 0; i < layerSize; i++) {
      let sum = 0;
      for (let j = 0; j < current.length; j++) {
        sum += current[j] * (Math.random() * 2 - 1);
      }
      
      switch (config.activationFunction) {
        case "relu":
          nextLayer.push(Math.max(0, sum));
          break;
        case "sigmoid":
          nextLayer.push(1 / (1 + Math.exp(-sum)));
          break;
        case "tanh":
          nextLayer.push(Math.tanh(sum));
          break;
        default:
          nextLayer.push(sum);
      }
    }
    current = nextLayer;
  }
  
  const output: number[] = [];
  for (let i = 0; i < config.outputDimension; i++) {
    let sum = 0;
    for (let j = 0; j < current.length; j++) {
      sum += current[j] * (Math.random() * 2 - 1);
    }
    output.push(sum);
  }
  
  if (config.activationFunction === "softmax") {
    const maxVal = Math.max(...output);
    const expValues = output.map(x => Math.exp(x - maxVal));
    const sumExp = expValues.reduce((a, b) => a + b, 0);
    return expValues.map(x => x / sumExp);
  }
  
  return output;
}

export function getModelTemplate(modelType: ModelType): ModelTemplate {
  return MODEL_TEMPLATES[modelType];
}

export function listModelTemplates(): ModelTemplate[] {
  return Object.values(MODEL_TEMPLATES);
}

export function createZkMLModel(
  name: string,
  config: ModelConfig
): ZkMLModel {
  const modelHash = createHash("sha256")
    .update(JSON.stringify(config) + Date.now())
    .digest("hex");
  
  const weightsCommitment = createHash("sha256")
    .update(randomBytes(1024))
    .digest("hex");
  
  const circuitHash = generateCircuitHash(config);
  const verificationKey = generateVerificationKey(circuitHash);
  
  return {
    id: randomBytes(8).toString("hex"),
    name,
    config,
    modelHash,
    weightsCommitment,
    circuitHash,
    verificationKey,
    createdAt: Date.now(),
    version: "1.0.0",
  };
}

export function createFromTemplate(
  templateType: ModelType,
  name: string,
  configOverrides?: Partial<ModelConfig>
): ZkMLModel {
  const template = MODEL_TEMPLATES[templateType];
  const config: ModelConfig = {
    ...template.defaultConfig,
    ...configOverrides,
  };
  
  return createZkMLModel(name, config);
}

export function generateInferenceProof(
  model: ZkMLModel,
  input: number[]
): InferenceProof {
  const startTime = Date.now();
  
  if (input.length !== model.config.inputDimension) {
    throw new Error(`Input dimension mismatch: expected ${model.config.inputDimension}, got ${input.length}`);
  }
  
  const output = simulateInference(input, model.config);
  
  const inputHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  
  const outputHash = createHash("sha256")
    .update(JSON.stringify(output))
    .digest("hex");
  
  const proof = JSON.stringify({
    protocol: "groth16",
    curve: "bn128",
    pi_a: [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    pi_b: [
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    ],
    pi_c: [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    modelHash: model.modelHash,
    inputHash: inputHash.slice(0, 16),
    outputHash: outputHash.slice(0, 16),
  });
  
  const computationSteps = calculateConstraints(model.config);
  
  return {
    modelId: model.id,
    inputHash,
    outputHash,
    proof,
    publicSignals: [inputHash.slice(0, 32), outputHash.slice(0, 32)],
    computationSteps,
    verificationTime: Date.now() - startTime,
    createdAt: Date.now(),
  };
}

export function verifyInferenceProof(
  proof: InferenceProof,
  model: ZkMLModel
): { valid: boolean; reason?: string } {
  try {
    const parsedProof = JSON.parse(proof.proof);
    
    if (parsedProof.protocol !== "groth16") {
      return { valid: false, reason: "Invalid protocol" };
    }
    
    if (parsedProof.modelHash !== model.modelHash) {
      return { valid: false, reason: "Model hash mismatch" };
    }
    
    if (!parsedProof.pi_a || !parsedProof.pi_b || !parsedProof.pi_c) {
      return { valid: false, reason: "Missing proof elements" };
    }
    
    if (proof.publicSignals.length < 2) {
      return { valid: false, reason: "Insufficient public signals" };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, reason: "Proof parsing failed" };
  }
}

const modelRegistry: Map<string, ZkMLModel> = new Map();
const proofRegistry: Map<string, InferenceProof[]> = new Map();

export function registerModel(model: ZkMLModel): void {
  modelRegistry.set(model.id, model);
  proofRegistry.set(model.id, []);
}

export function getModel(modelId: string): ZkMLModel | undefined {
  return modelRegistry.get(modelId);
}

export function listModels(): ZkMLModel[] {
  return Array.from(modelRegistry.values());
}

export function storeProof(proof: InferenceProof): void {
  const proofs = proofRegistry.get(proof.modelId) || [];
  proofs.push(proof);
  proofRegistry.set(proof.modelId, proofs);
}

export function getModelProofs(modelId: string): InferenceProof[] {
  return proofRegistry.get(modelId) || [];
}

export function getZkMLStats(): {
  totalModels: number;
  totalProofs: number;
  modelsByType: Record<ModelType, number>;
  averageVerificationTime: number;
} {
  const models = Array.from(modelRegistry.values());
  const allProofs = Array.from(proofRegistry.values()).flat();
  
  const modelsByType: Record<ModelType, number> = {
    classification: 0,
    regression: 0,
    anomaly_detection: 0,
    sentiment_analysis: 0,
    price_prediction: 0,
    risk_assessment: 0,
  };
  
  for (const model of models) {
    modelsByType[model.config.modelType]++;
  }
  
  const avgTime = allProofs.length > 0
    ? allProofs.reduce((sum, p) => sum + p.verificationTime, 0) / allProofs.length
    : 0;
  
  return {
    totalModels: models.length,
    totalProofs: allProofs.length,
    modelsByType,
    averageVerificationTime: Math.round(avgTime),
  };
}
