'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 检查 URL 参数中是否包含管理员标识
    const urlParams = new URLSearchParams(window.location.search);
    const whois = urlParams.get('whois');
    
    if (whois === 'qiaomu') {
      setIsAdmin(true);
      // 将管理员状态保存到 sessionStorage，避免每次都需要输入参数
      sessionStorage.setItem('isAdmin', 'true');
    } else {
      // 检查 sessionStorage 中是否已经有管理员状态
      const savedAdminStatus = sessionStorage.getItem('isAdmin');
      setIsAdmin(savedAdminStatus === 'true');
    }
  }, []);

  const logout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('isAdmin');
    // 清除 URL 参数并刷新页面
    const url = new URL(window.location.href);
    url.searchParams.delete('whois');
    window.location.href = url.toString();
  };

  return { isAdmin, logout };
}
