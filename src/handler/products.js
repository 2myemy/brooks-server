const host = import.meta.env.VITE_API_BASE_URL;

export interface Product {
  id: string;
  name: string;
  price: string;
  condition: string;
  course: string;
  subject: string;
  imageUrl?: string;
  status: string;
}

export interface ProductList {
  items: Partial<Product>[];
  limit: number;
  offset: number;
  total: number;
}

export interface ProductRequest {
  subject: string;
  course: string;
  image: any;
  condition: string;
  email: string;
  price: string;
}

export interface ProductModifyRequest {
  id: string;
  name: string;
  subject: string;
  course: string;
  image: any;
  condition: string;
  email: string;
  price: string;
}

export const getProductList = async (
  subject?: string,
  course?: string,
  query?: string,
  limit?: number,
  offset?: number
): Promise<ProductList> => {
  let url = `${host}/products?limit=${limit ?? 20}&offset=${offset ?? 0}`;
  if (subject) {
    url += `&subject=${subject}`;
    if (course) {
      url += `&course=${course}`;
    }
  }
  if (query) {
    url += `&query=${query}`;
  }
  const products = await fetch(url);
  return await products.json();
};

export const postProduct = async (body: ProductRequest): Promise<Product> => {
  const formData = new FormData();
  formData.append("subject", body.subject);
  formData.append("course", body.course);
  formData.append("condition", body.condition);
  formData.append("email", body.email);
  formData.append("price", body.price);
  formData.append("image", body.image);

  const product = await fetch(`${host}/products`, {
    method: "POST",
    body: formData,
  });
  return await product.json();
};

export const modifyProduct = async (body: ProductModifyRequest): Promise<Product> => {
  const formData = new FormData();
  formData.append("name", body.name);
  formData.append("subject", body.subject);
  formData.append("course", body.course);
  formData.append("condition", body.condition);
  formData.append("email", body.email);
  formData.append("price", body.price);
  formData.append("image", body.image);

  const product = await fetch(`${host}/products/modify/${body.id}`, {
    method: "POST",
    body: formData,
  });
  return await product.json();
};

export const deleteProduct = async (id: string): Promise<Product> => {
  const products = await fetch(`${host}/products/${id}`, {
    method: "DELETE"
  });
  return await products.json();
};

export const getProduct = async (id: string): Promise<Product> => {
  const products = await fetch(`${host}/products/${id}`);
  return await products.json();
};

export const buyProduct = async (id: string): Promise<Product> => {
  const products = await fetch(`${host}/products/${id}`, {
    method: "PATCH",
  });
  return await products.json();
};
