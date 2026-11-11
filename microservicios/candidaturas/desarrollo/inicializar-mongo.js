// Usuario limitado a la única base propia de esta demostración.
const base = db.getSiblingDB(process.env.MONGODB_DATABASE);
base.createUser({
  user: process.env.MONGODB_USERNAME,
  pwd: process.env.MONGODB_PASSWORD,
  roles: [{ role: "readWrite", db: process.env.MONGODB_DATABASE }],
});
