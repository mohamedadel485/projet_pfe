import path from 'path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import dotenv from 'dotenv';
import User from '../models/User';
import { connectDB, disconnectDB } from '../config/database';
import { ADMIN_ROLES } from '../utils/roles';

const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath, override: true });

interface CliOptions {
  email?: string;
  name?: string;
  password?: string;
  help: boolean;
}

interface AdminCredentials {
  email: string;
  name: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const printUsage = (): void => {
  console.log('Usage: npm run create:first-admin -- [--email admin@example.com --name "Super Admin" --password "secret123"]');
  console.log('Si des arguments sont manquants, le script les demandera dans le terminal.');
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg.startsWith('--email=')) {
      options.email = arg.slice('--email='.length);
      continue;
    }

    if (arg === '--email') {
      options.email = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--name=')) {
      options.name = arg.slice('--name='.length);
      continue;
    }

    if (arg === '--name') {
      options.name = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--password=')) {
      options.password = arg.slice('--password='.length);
      continue;
    }

    if (arg === '--password') {
      options.password = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return options;
};

const validateEmail = (value: string): string | null => {
  if (value.trim() === '') return 'Email requis.';
  if (!EMAIL_PATTERN.test(value.trim())) return 'Email invalide.';
  return null;
};

const validateName = (value: string): string | null => {
  if (value.trim() === '') return 'Nom requis.';
  return null;
};

const validatePassword = (value: string): string | null => {
  if (value.trim() === '') return 'Mot de passe requis.';
  if (value.length < 6) return 'Le mot de passe doit contenir au moins 6 caracteres.';
  return null;
};

const normalizeCredentials = (options: CliOptions): AdminCredentials | null => {
  const email = options.email?.trim();
  const name = options.name?.trim();
  const password = options.password ?? '';

  if (!email || !name || password === '') {
    return null;
  }

  const emailError = validateEmail(email);
  if (emailError) {
    throw new Error(emailError);
  }

  const nameError = validateName(name);
  if (nameError) {
    throw new Error(nameError);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  return {
    email: email.toLowerCase(),
    name,
    password,
  };
};

const promptForCredentials = async (options: CliOptions): Promise<AdminCredentials> => {
  const rl = createInterface({ input, output });

  const askUntilValid = async (
    label: string,
    initialValue: string | undefined,
    validate: (value: string) => string | null
  ): Promise<string> => {
    let candidate = initialValue?.trim() ?? '';

    while (true) {
      if (candidate === '') {
        candidate = (await rl.question(label)).trim();
      }

      const validationError = validate(candidate);
      if (!validationError) {
        return candidate;
      }

      console.log(validationError);
      candidate = '';
    }
  };

  try {
    const email = (await askUntilValid('Email super admin: ', options.email, validateEmail)).toLowerCase();
    const name = await askUntilValid('Nom super admin: ', options.name, validateName);

    let password = options.password ?? '';
    while (true) {
      if (password === '') {
        password = await rl.question('Mot de passe super admin: ');
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        console.log(passwordError);
        password = '';
        continue;
      }

      if (!options.password) {
        const confirmation = await rl.question('Confirmer le mot de passe: ');
        if (confirmation !== password) {
          console.log('Les mots de passe ne correspondent pas.');
          password = '';
          continue;
        }
      }

      return { email, name, password };
    }
  } finally {
    rl.close();
  }
};

const resolveCredentials = async (options: CliOptions): Promise<AdminCredentials> => {
  const normalized = normalizeCredentials(options);
  if (normalized) {
    return normalized;
  }

  if (!input.isTTY) {
    throw new Error('Mode interactif indisponible. Passez --email, --name et --password.');
  }

  return promptForCredentials(options);
};

const ensureDatabaseIsEmpty = async (): Promise<void> => {
  const adminCount = await User.countDocuments({ role: { $in: ADMIN_ROLES } });
  if (adminCount > 0) {
    throw new Error('Un super administrateur existe deja. Ce script sert uniquement a creer le premier super admin.');
  }

  const userCount = await User.countDocuments();
  if (userCount > 0) {
    throw new Error('Des utilisateurs existent deja. Refus de creer un premier super admin sur une base non vide.');
  }
};

const createFirstAdmin = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const credentials = await resolveCredentials(options);

  await connectDB();

  try {
    await ensureDatabaseIsEmpty();

    const user = new User({
      email: credentials.email,
      name: credentials.name,
      password: credentials.password,
      role: 'super_admin',
      isActive: true,
    });

    await user.save();

    console.log('');
    console.log('Premier super administrateur cree avec succes.');
    console.log(`Email: ${user.email}`);
    console.log(`Nom: ${user.name}`);
    console.log(`ID: ${String(user._id)}`);
  } finally {
    await disconnectDB();
  }
};

void createFirstAdmin().catch(async (error: unknown) => {
  console.error('');
  console.error('Impossible de creer le premier super administrateur.');
  console.error(error instanceof Error ? error.message : error);

  try {
    await disconnectDB();
  } catch {
    // Ignore disconnect errors in CLI shutdown.
  }

  process.exitCode = 1;
});
