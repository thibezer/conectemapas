function d(e) {
  if (e.disabled)
    return { valido: !0, flags: {}, mensagem: "" };
  if (e.customError && e.customError.trim() !== "")
    return {
      valido: !1,
      flags: { customError: !0 },
      mensagem: e.customError
    };
  const { val: a, rawVal: n, badInput: s, required: u, tipo: l = "text", mensagemValidacao: t } = e;
  if (s || l === "number" && n && isNaN(Number(n)))
    return {
      valido: !1,
      flags: { badInput: !0 },
      mensagem: t || "Insira um número válido."
    };
  if (u && a.trim() === "")
    return {
      valido: !1,
      flags: { valueMissing: !0 },
      mensagem: t || "Preencha este campo."
    };
  if (a === "")
    return { valido: !0, flags: {}, mensagem: "" };
  if (e.minlength !== null && e.minlength !== void 0 && !isNaN(e.minlength) && a.length < e.minlength)
    return {
      valido: !1,
      flags: { tooShort: !0 },
      mensagem: t || `Use pelo menos ${e.minlength} caracteres (atualmente você está usando ${a.length}).`
    };
  if (e.maxlength !== null && e.maxlength !== void 0 && !isNaN(e.maxlength) && a.length > e.maxlength)
    return {
      valido: !1,
      flags: { tooLong: !0 },
      mensagem: t || `Reduza o texto para no máximo ${e.maxlength} caracteres (atualmente você está usando ${a.length}).`
    };
  if (e.pattern)
    try {
      if (!new RegExp(`^(?:${e.pattern})$`).test(a))
        return {
          valido: !1,
          flags: { patternMismatch: !0 },
          mensagem: t || "O valor não corresponde ao padrão solicitado."
        };
    } catch {
    }
  if (l === "email" && !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(a))
    return {
      valido: !1,
      flags: { typeMismatch: !0 },
      mensagem: t || "Insira um endereço de e-mail válido."
    };
  if (l === "url")
    try {
      new URL(a);
    } catch {
      return {
        valido: !1,
        flags: { typeMismatch: !0 },
        mensagem: t || "Insira uma URL válida."
      };
    }
  if (l === "number") {
    const i = Number(a);
    if (isNaN(i))
      return {
        valido: !1,
        flags: { badInput: !0 },
        mensagem: t || "Insira um número válido."
      };
    if (e.min !== null && e.min !== void 0 && !isNaN(e.min) && i < e.min)
      return {
        valido: !1,
        flags: { rangeUnderflow: !0 },
        mensagem: t || `O valor deve ser maior ou igual a ${e.min}.`
      };
    if (e.max !== null && e.max !== void 0 && !isNaN(e.max) && i > e.max)
      return {
        valido: !1,
        flags: { rangeOverflow: !0 },
        mensagem: t || `O valor deve ser menor ou igual a ${e.max}.`
      };
    if (e.step && e.step !== "any") {
      const m = parseFloat(e.step);
      if (!isNaN(m) && m > 0) {
        const f = e.min !== null && e.min !== void 0 && !isNaN(e.min) ? e.min : 0, o = Math.abs((i - f) % m);
        if (o > 1e-6 && Math.abs(o - m) > 1e-6)
          return {
            valido: !1,
            flags: { stepMismatch: !0 },
            mensagem: t || "Insira um valor válido de acordo com o intervalo."
          };
      }
    }
  }
  return { valido: !0, flags: {}, mensagem: "" };
}
function r(e, a, n) {
  !e || typeof e.setValidity != "function" || (a.valido ? e.setValidity({}) : e.setValidity(a.flags, a.mensagem || "Valor inválido.", n));
}
export {
  r as a,
  d as v
};
