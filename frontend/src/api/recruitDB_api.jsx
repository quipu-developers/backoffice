import http from "../auth/authClient";

export const fetchGeneralData = async () => {
  const response = await http.get("/bo/data/joinquipu_general", {
    headers: { accept: "application/json" },
  });
  return response.data;
};

export const fetchDevData = async () => {
  const response = await http.get("/bo/data/joinquipu_dev", {
    headers: { accept: "application/json" },
  });
  return response.data;
};

export const fetchMemberData = async () => {
  const response = await http.get("/bo/member", {
    headers: { accept: "application/json" },
  });
  return response.data;
};

const getPdf = async (filename) => {
  try {
    const response = await http.get(`/bo/member/pdf/${filename}`, {
      headers: { accept: "application/json" },
      responseType: "blob",
    });
    return response;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return { status: 404 };
    }
    throw err;
  }
};

const downloadPdf = (filename, blob) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const fetchAndSavePortfolio = async (filename) => {
  try {
    const response = await getPdf(filename);
    if (response.status === 200) {
      downloadPdf(filename, response.data);
    } else if (response.status === 404) {
      alert("파일이 존재하지 않습니다.");
    }
  } catch (_error) {
    alert("서버 에러");
  }
};

export const recruitStateCheck = async () => {
  const response = await http.get("/bo/feature/recruit", {
    headers: { accept: "application/json" },
  });
  return response;
};

export const recruitStateChange = async () => {
  const response = await http.patch(
    "/bo/feature/recruit",
    {},
    {
      headers: { accept: "application/json" },
    }
  );
  return response;
};
