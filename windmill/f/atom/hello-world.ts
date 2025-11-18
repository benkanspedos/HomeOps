/**
 * Hello World Script
 *
 * A simple test script to verify CI/CD pipeline is working.
 * This script will be automatically synced to Windmill via GitHub Actions.
 *
 * @param name - Name to greet (default: "World")
 * @returns Greeting message
 */
export async function main(name: string = "World") {
  const timestamp = new Date().toISOString();

  console.log(`Executing hello-world script at ${timestamp}`);

  return {
    message: `Hello, ${name}!`,
    timestamp,
    deployedFrom: "GitHub Actions",
    environment: "homeops"
  };
}
