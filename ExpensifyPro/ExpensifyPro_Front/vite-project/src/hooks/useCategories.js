import { useEffect, useState } from "react";
import { apiService } from "../api";

const getVersion = () => localStorage.getItem("categories_version") || "0";

export const bumpCategoriesVersion = () => {
  const stamp = Date.now().toString();
  localStorage.setItem("categories_version", stamp);
  window.dispatchEvent(new Event("categories:updated"));
};

export default function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(getVersion());

  useEffect(() => {
    const storageHandler = (event) => {
      if (event.key === "categories_version") {
        setVersion(event.newValue || Date.now().toString());
      }
    };
    const signalHandler = () => setVersion(Date.now().toString());
    window.addEventListener("storage", storageHandler);
    window.addEventListener("categories:updated", signalHandler);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("categories:updated", signalHandler);
    };
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiService.getCategories({ page: 1, page_size: 200 });
      setCategories(res?.results ?? []);
    } catch (e) {
      setError(e?.message || "Failed to load categories");
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const categoriesMap = categories.reduce((acc, category) => {
    acc[category.id] = category;
    return acc;
  }, {});

  return { categories, categoriesMap, loading, error, refreshCategories: fetchCategories };
}
