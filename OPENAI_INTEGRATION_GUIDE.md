# 🤖 OpenAI Integration Guide for OneTimer Bob

## Overview

OneTimer Bob now includes comprehensive OpenAI integration for AI-powered features including:
- Jira issue analysis and intent extraction
- Automatic XML generation from Jira data
- Task breakdown and workflow generation
- Conversational AI agent assistance
- Mainframe output explanation

---

## 🚀 Quick Setup

### Step 1: Get Your OpenAI API Key

1. **Visit OpenAI Platform:**
   ```
   https://platform.openai.com/signup
   ```

2. **Sign Up:**
   - Use email, Google, or Microsoft account
   - Verify your email address

3. **Add Payment Method:**
   - Go to Settings → Billing
   - Add a payment method (credit/debit card)
   - Add initial credit ($5-10 recommended)

4. **Create API Key:**
   - Go to https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Name it "OneTimer Bob"
   - Copy your key (starts with `sk-...`)
   - **Save it securely!** You won't see it again

### Step 2: Configure Environment Variables

Add to your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your_actual_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

**Windows PowerShell:**
```powershell
$env:OPENAI_API_KEY="sk-your_actual_api_key_here"
```

**Linux/Mac:**
```bash
export OPENAI_API_KEY="sk-your_actual_api_key_here"
```

### Step 3: Install Dependencies

```bash
cd backend
npm install
```

This will install the OpenAI SDK (version 4.67.3).

---

## 📦 What's Included

### OpenAI Service (`backend/src/services/openai.service.ts`)

A comprehensive service providing:

1. **Jira Issue Analysis**
   - Extracts intent and claim details
   - Identifies key points
   - Provides recommendations

2. **XML Generation**
   - Converts Jira data to structured XML
   - Maintains proper hierarchy
   - Clean, readable output

3. **Task Breakdown**
   - Breaks requirements into actionable tasks
   - Assigns priorities and estimates
   - Identifies dependencies
   - Creates workflow sequences

4. **AI Agent Chat**
   - Conversational assistance
   - Tool calling capabilities
   - Multi-turn conversations
   - Confirmation handling

5. **Output Explanation**
   - Analyzes mainframe logs
   - Identifies errors and warnings
   - Provides recommendations
   - Simple, clear explanations

---

## 🎯 Usage Examples

### 1. Analyze Jira Issue

```typescript
import { openAIService } from './services/openai.service';

const analysis = await openAIService.analyzeJiraIssue(jiraData);

console.log(analysis.summary);
console.log(analysis.intent);
console.log(analysis.claimDetails);
console.log(analysis.keyPoints);
console.log(analysis.recommendations);
```

**Response Structure:**
```json
{
  "summary": "Brief 2-3 sentence summary",
  "intent": "What the user wants to accomplish",
  "claimDetails": {
    "icn": "Claim ICN",
    "memberId": "Member ID",
    "providerId": "Provider ID",
    "claimAmount": "Amount",
    "serviceDate": "Date"
  },
  "keyPoints": ["Point 1", "Point 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}
```

### 2. Generate XML from Jira

```typescript
const xml = await openAIService.generateXMLFromJira(jiraData);
console.log(xml);
```

**Output:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<jira-issue>
  <key>PROJ-123</key>
  <type>Story</type>
  <summary>Process claim for member</summary>
  <claim-details>
    <icn>ICN12345</icn>
    <member-id>MEM67890</member-id>
  </claim-details>
</jira-issue>
```

### 3. Generate Task Breakdown

```typescript
const breakdown = await openAIService.generateTaskBreakdown(requirements);

console.log(breakdown.tasks);
console.log(breakdown.workflow);
```

**Response Structure:**
```json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Validate claim data",
      "description": "Check all required fields",
      "priority": "high",
      "estimatedTime": "30 minutes",
      "dependencies": []
    }
  ],
  "workflow": ["task-1", "task-2", "task-3"]
}
```

### 4. AI Agent Chat

```typescript
const response = await openAIService.agentChat(
  "Analyze PROJ-123 and create a task breakdown",
  conversationHistory
);

console.log(response.response);
console.log(response.toolCalls);
console.log(response.needsConfirmation);
```

### 5. Explain Mainframe Output

```typescript
const explanation = await openAIService.explainOutput(
  logContent,
  "JCL job execution"
);

console.log(explanation.summary);
console.log(explanation.status); // 'success' | 'failure' | 'warning'
console.log(explanation.keySteps);
console.log(explanation.errors);
console.log(explanation.recommendations);
```

---

## 💰 Pricing & Cost Estimates

### GPT-4o-mini Pricing

| Type | Cost |
|------|------|
| Input tokens | $0.15 per 1M tokens |
| Output tokens | $0.60 per 1M tokens |

### Typical Request Costs

**Jira Analysis:**
- Input: ~800 tokens
- Output: ~400 tokens
- **Cost: ~$0.0004** (less than a penny!)

**XML Generation:**
- Input: ~1000 tokens
- Output: ~600 tokens
- **Cost: ~$0.0005**

**Task Breakdown:**
- Input: ~1200 tokens
- Output: ~800 tokens
- **Cost: ~$0.0007**

**AI Agent (multi-turn):**
- Input: ~1500 tokens
- Output: ~1000 tokens
- **Cost: ~$0.0009**

### Monthly Cost Estimates

| Usage Level | Requests/Day | Monthly Cost |
|-------------|--------------|--------------|
| **Light** | 10-20 | $2-5 |
| **Moderate** | 50-100 | $10-20 |
| **Heavy** | 200-500 | $30-75 |

💡 **Tip:** Set a monthly spending limit in your OpenAI account!

---

## 🔒 Security Best Practices

1. **Never commit API keys to Git**
   ```bash
   # Already in .gitignore
   .env
   *.key
   ```

2. **Use environment variables**
   ```env
   OPENAI_API_KEY=sk-your_key
   ```

3. **Rotate keys regularly**
   - Create new key every 90 days
   - Delete old keys from OpenAI dashboard

4. **Set spending limits**
   - Go to https://platform.openai.com/settings/organization/billing/limits
   - Set monthly budget (e.g., $20)
   - Enable email notifications

5. **Monitor usage**
   - Check https://platform.openai.com/usage daily
   - Review API logs for unusual activity

---

## 🛠️ Configuration Options

### Model Selection

In `.env`:
```env
# Recommended (Fast, cheap, great quality)
OPENAI_MODEL=gpt-4o-mini

# More powerful (10x cost)
OPENAI_MODEL=gpt-4o

# Legacy (not recommended)
OPENAI_MODEL=gpt-3.5-turbo
```

### Temperature Settings

In `openai.service.ts`, adjust for different use cases:

```typescript
// Factual, consistent (analysis, extraction)
temperature: 0.1-0.3

// Balanced (general use)
temperature: 0.3-0.5

// Creative (brainstorming, ideation)
temperature: 0.6-0.9
```

---

## 🔍 Error Handling

The service includes comprehensive error handling:

### Common Errors

1. **API Key Not Configured**
   ```
   Error: OpenAI API key not configured or invalid
   Solution: Set OPENAI_API_KEY environment variable
   ```

2. **Quota Exceeded**
   ```
   Error: OpenAI API quota exceeded
   Solution: Add credits to your OpenAI account
   ```

3. **Rate Limit**
   ```
   Error: OpenAI API rate limit exceeded
   Solution: Wait a moment and try again
   ```

4. **No Response**
   ```
   Error: No response from OpenAI API
   Solution: Check internet connection
   ```

---

## 📊 Monitoring & Logging

### Check Service Status

```typescript
if (openAIService.isAvailable()) {
  console.log('OpenAI service is ready');
} else {
  console.log('OpenAI service is not configured');
}
```

### View Logs

The service uses Winston logger:
```typescript
import { logger } from './utils/logger';

logger.info('OpenAI request started');
logger.error('OpenAI request failed:', error);
```

### Monitor Usage

1. **OpenAI Dashboard:**
   - https://platform.openai.com/usage
   - View daily/monthly usage
   - Track costs by model

2. **Application Logs:**
   - Check `logs/app.log`
   - Monitor request/response times
   - Track error rates

---

## 🧪 Testing

### Test OpenAI Integration

```bash
# Start backend
cd backend
npm run dev
```

### Test Endpoints

1. **Analyze Jira Issue:**
   ```bash
   POST /api/jira/analyze
   {
     "issueKey": "PROJ-123"
   }
   ```

2. **Generate Task Breakdown:**
   ```bash
   POST /api/tasks/generate
   {
     "requirements": "Process healthcare claim..."
   }
   ```

3. **AI Agent Chat:**
   ```bash
   POST /api/agent/chat
   {
     "message": "Analyze PROJ-123",
     "conversationHistory": []
   }
   ```

---

## 🚀 Next Steps

1. ✅ Get OpenAI API key
2. ✅ Configure environment variables
3. ✅ Install dependencies (`npm install`)
4. ✅ Test the service
5. ✅ Set spending limits
6. ✅ Monitor usage
7. ✅ Integrate into your workflows

---

## 📚 Additional Resources

- **OpenAI Documentation:** https://platform.openai.com/docs
- **OpenAI Community:** https://community.openai.com/
- **API Status:** https://status.openai.com/
- **Support:** https://help.openai.com/

---

## 🎉 Features Enabled

With OpenAI integration, OneTimer Bob can now:

✅ Automatically analyze Jira issues and extract intent  
✅ Generate structured XML from unstructured data  
✅ Break down complex requirements into tasks  
✅ Provide conversational AI assistance  
✅ Explain mainframe logs in simple terms  
✅ Make intelligent recommendations  
✅ Support multi-turn conversations  
✅ Handle complex workflows  

---

**Made with ❤️ for OneTimer Bob**

*Powered by OpenAI GPT-4o-mini*  
*Last Updated: 2026-04-29*