import { messages, type Locale } from "@lineskip/shared";

let locale: Locale = "es";

export function setLocale(next: Locale) {
  locale = next;
}

export function t(key: keyof (typeof messages)["es"]) {
  return messages[locale][key];
}

export function currentLocale() {
  return locale;
}
