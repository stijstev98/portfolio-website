export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'generated_admin_jwt_secret_12345'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', 'generated_api_token_salt_12345'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', 'generated_transfer_token_salt_12345'),
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY', 'generated_encryption_key_12345'),
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
