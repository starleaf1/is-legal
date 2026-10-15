# Is Legal? (Working title)
Is Legal is a multi-tenant, SaaS-like system primarily consisting of a chatbot agent that serves an organization's employee. Its primary purpose is to provide advice regarding the legality and policy compliance of a proposed action upon being prompted.

# How it works
The org provides all relevant documents including Code of Conduct, Company Policy, Local/Regional/National Laws, or declassified files regarding previous cases of dispute. These documents are indexed and classified. Upon being asked, Is Legal agent composes a response based on the documents provided.

# Tech Stack
- Google Cloud Storage for storing documents
- Firebase Auth for authentication and access control
- Genkit and Gemini for chat capabilities
- Firestore for storing document classification and URLs
- Vue for frontend
- Firebase/Cloud Run Functions for back-end stuff.
