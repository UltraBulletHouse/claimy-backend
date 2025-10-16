export const typeDefs = /* GraphQL */ `
  enum CaseStatus {
    PENDING
    NEED_INFO
    APPROVED
    REJECTED
  }

  type User {
    id: ID!
    email: String!
    fcmToken: String
    createdAt: String!
    updatedAt: String!
  }

  type Case {
    id: ID!
    userId: ID!
    store: String!
    product: String!
    description: String!
    images: [String!]!
    status: CaseStatus!
    createdAt: String!
    updatedAt: String!
  }

  type Reward {
    id: ID!
    userId: ID!
    store: String!
    code: String!
    amount: Float!
    used: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    getCases: [Case!]!
    getRewards: [Reward!]!
  }

  type Mutation {
    signup(email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    createCase(store: String!, product: String!, description: String!, images: [String!]): Case!
    updateCaseStatus(id: ID!, status: CaseStatus!): Case!
    addReward(store: String!, code: String!, amount: Float!): Reward!
    markRewardUsed(id: ID!, used: Boolean!): Reward!
    sendNotification(title: String!, body: String!, userId: ID!): Boolean!
    updateFcmToken(token: String!): User!
  }
`;
