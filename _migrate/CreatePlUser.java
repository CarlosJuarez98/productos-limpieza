import java.sql.*;
import java.util.Properties;

public class CreatePlUser {
  public static void main(String[] args) throws Exception {
    String url = "jdbc:oracle:thin:@cgatodb_tp";
    Properties props = new Properties();
    props.setProperty("user", "ADMIN");
    props.setProperty("password", args.length > 0 ? args[0] : System.getenv("ATP_ADMIN_PASSWORD"));
    System.out.println("Connecting as ADMIN...");
    try (Connection conn = DriverManager.getConnection(url, props);
         Statement st = conn.createStatement()) {
      try {
        st.execute("CREATE USER productos_limpieza IDENTIFIED BY \"PlApp#2798Cloud!\"");
        System.out.println("CREATE USER ok");
      } catch (SQLException e) {
        if (e.getErrorCode() == 1920) System.out.println("USER already exists");
        else throw e;
      }
      st.execute("GRANT CONNECT TO productos_limpieza");
      st.execute("GRANT RESOURCE TO productos_limpieza");
      st.execute("GRANT UNLIMITED TABLESPACE TO productos_limpieza");
      System.out.println("GRANTS ok");
    }
  }
}
