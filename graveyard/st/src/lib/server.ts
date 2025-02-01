import {db} from "./db"
import crypto from "crypto"

export function validateEmail(email: string) {
	if (!email) {
		return "Email is required."
	} else if (!email.includes("@")) {
		return "Please enter a valid email address."
	}
}

export function validateName(name: string) {
	if (!name) {
		return "Name is required."
	}
}

export function validatePassword(password: string) {
	if (!password) {
		return "Password is required."
	} else if (password.length < 6) {
		return "Password must be at least 6 characters."
	}
}

export async function login(name: string) {
	let user =
		(await db.account.findUnique({
			where: {email: name},
		})) ??
		db.account.create({
			data: {
				email: name,
			},
		})

	if (!user) {
		throw new Error("Account not found!")
	}

	return user
}

export async function accountExists(email: string) {
	let account = await db.account.findUnique({
		where: {email: email},
		select: {id: true},
	})

	return Boolean(account)
}

export async function register(email: string, password: string) {
	const userExists = await accountExists(email)
	if (userExists) throw new Error("User already exists")

	let salt = crypto.randomBytes(16).toString("hex")
	let hash = crypto
		.pbkdf2Sync(password, salt, 1000, 64, "sha256")
		.toString("hex")

	return db.account.create({
		data: {
			email: email,
			Password: {create: {hash, salt}},
		},
	})
}
